'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

async function requireAdmin() {
  const me = await getCurrentUser()
  if (!me || (me.role !== 'admin' && me.role !== 'super_admin')) throw new Error('ไม่มีสิทธิ์')
  return me
}

// ---- Whitelist (allowed_emails) ----
const addEmailSchema = z.object({
  email: z.string().email(),
  role: z.enum(['employee', 'admin', 'super_admin']),
  teamId: z.string().uuid().nullable().optional(),
  fullName: z.string().max(100).optional(),
})

export async function addAllowedEmailAction(input: unknown) {
  const me = await requireAdmin()
  const parsed = addEmailSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'อีเมลไม่ถูกต้อง' }
  // admin ทั่วไปเพิ่มได้เฉพาะ employee (กันยกระดับสิทธิ์)
  if (me.role === 'admin' && parsed.data.role !== 'employee') {
    return { ok: false as const, error: 'ผู้จัดการเพิ่มได้เฉพาะพนักงาน' }
  }
  const d = parsed.data

  const email = d.email.toLowerCase()
  const supabase = createClient()

  // ถ้ามี row เดิม (รวมที่เคยลบ = soft-deleted) → กู้คืน/อัปเดตแทน insert
  // (email เป็น unique ทั้งตาราง insert ซ้ำจะชน constraint)
  const { data: existing } = await supabase
    .from('allowed_emails')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  const { error } = existing
    ? await supabase
        .from('allowed_emails')
        .update({
          role: d.role,
          team_id: d.teamId ?? me.team_id,
          full_name: d.fullName ?? null,
          deleted_at: null,
        } as never)
        .eq('id', existing.id)
    : await supabase.from('allowed_emails').insert({
        email,
        role: d.role,
        team_id: d.teamId ?? me.team_id,
        full_name: d.fullName ?? null,
        created_by: me.id,
      } as never)

  if (error) return { ok: false as const, error: 'เพิ่มไม่สำเร็จ (สิทธิ์ไม่พอ)' }

  await writeAudit({
    action: 'setting_updated',
    actorId: me.id,
    actorEmail: me.email,
    entityType: 'allowed_email',
    metadata: { added: d.email, role: d.role },
  })
  revalidatePath('/admin/team')
  return { ok: true as const }
}

// ---- เปลี่ยนสิทธิ์ผู้ใช้ (super_admin เท่านั้น) ----
const changeRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['employee', 'admin', 'super_admin']),
})

export async function changeUserRoleAction(input: unknown) {
  const me = await getCurrentUser()
  if (!me || me.role !== 'super_admin') return { ok: false as const, error: 'เฉพาะ Super Admin' }

  const parsed = changeRoleSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลไม่ถูกต้อง' }
  const { userId, role } = parsed.data

  // กันล็อกตัวเองออกจากระบบ (เปลี่ยนสิทธิ์ตัวเองไม่ได้)
  if (userId === me.id) return { ok: false as const, error: 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้' }

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('users')
    .select('email, role')
    .eq('id', userId)
    .maybeSingle()
  if (!target) return { ok: false as const, error: 'ไม่พบผู้ใช้' }

  const { error } = await admin.from('users').update({ role } as never).eq('id', userId)
  if (error) return { ok: false as const, error: 'เปลี่ยนสิทธิ์ไม่สำเร็จ' }

  // sync role ใน whitelist ให้ตรง (กันสับสนเมื่อดูรายชื่อ/ลบแล้วเพิ่มใหม่)
  await admin
    .from('allowed_emails')
    .update({ role } as never)
    .ilike('email', target.email)

  await writeAudit({
    action: 'setting_updated',
    actorId: me.id,
    actorEmail: me.email,
    entityType: 'user_role',
    entityId: userId,
    metadata: { email: target.email, from: target.role, to: role },
  })
  revalidatePath('/admin/team')
  return { ok: true as const }
}

export async function removeAllowedEmailAction(input: unknown) {
  const me = await requireAdmin()
  const id = z.string().uuid().safeParse((input as { id?: string })?.id)
  if (!id.success) return { ok: false as const, error: 'ข้อมูลไม่ถูกต้อง' }

  const supabase = createClient()
  const { error } = await supabase
    .from('allowed_emails')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id.data)

  if (error) return { ok: false as const, error: 'ลบไม่สำเร็จ' }
  revalidatePath('/admin/team')
  return { ok: true as const }
}

// ---- Work location ของพนักงาน ----
const locationSchema = z.object({
  userId: z.string().uuid(),
  label: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(50).max(2000),
})

export async function upsertWorkLocationAction(input: unknown) {
  const me = await requireAdmin()
  const parsed = locationSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลพิกัดไม่ถูกต้อง' }
  const d = parsed.data

  // ใช้ session client → RLS locations_admin บังคับขอบเขตทีม
  const supabase = createClient()
  const { error } = await supabase.from('work_locations').insert({
    user_id: d.userId,
    label: d.label,
    latitude: d.latitude,
    longitude: d.longitude,
    radius_meters: d.radiusMeters,
    created_by: me.id,
  } as never)

  if (error) return { ok: false as const, error: 'บันทึกพื้นที่ไม่สำเร็จ' }

  await writeAudit({
    action: 'setting_updated',
    actorId: me.id,
    actorEmail: me.email,
    entityType: 'work_location',
    entityId: d.userId,
    metadata: { label: d.label, radius: d.radiusMeters },
  })
  revalidatePath('/admin/team')
  return { ok: true as const }
}

const locationUpdateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(50).max(2000),
})

/** แก้ไขพื้นที่ทำงาน (RLS จำกัดขอบเขตทีม) */
export async function updateWorkLocationAction(input: unknown) {
  const me = await requireAdmin()
  const parsed = locationUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลพิกัดไม่ถูกต้อง' }
  const d = parsed.data

  const supabase = createClient()
  const { error } = await supabase
    .from('work_locations')
    .update({
      label: d.label,
      latitude: d.latitude,
      longitude: d.longitude,
      radius_meters: d.radiusMeters,
    } as never)
    .eq('id', d.id)

  if (error) return { ok: false as const, error: 'แก้ไขพื้นที่ไม่สำเร็จ' }

  await writeAudit({
    action: 'setting_updated',
    actorId: me.id,
    actorEmail: me.email,
    entityType: 'work_location',
    entityId: d.id,
    metadata: { updated: d.label, radius: d.radiusMeters },
  })
  revalidatePath('/admin/team')
  return { ok: true as const }
}

/** ลบพื้นที่ทำงาน (soft delete — ปิดใช้งาน ไม่ถูกใช้คำนวณ geofence อีก) */
export async function deleteWorkLocationAction(input: unknown) {
  const me = await requireAdmin()
  const id = z.string().uuid().safeParse((input as { id?: string })?.id)
  if (!id.success) return { ok: false as const, error: 'ข้อมูลไม่ถูกต้อง' }

  const supabase = createClient()
  const { error } = await supabase
    .from('work_locations')
    .update({ is_active: false, deleted_at: new Date().toISOString() } as never)
    .eq('id', id.data)

  if (error) return { ok: false as const, error: 'ลบไม่สำเร็จ' }

  await writeAudit({
    action: 'setting_updated',
    actorId: me.id,
    actorEmail: me.email,
    entityType: 'work_location',
    entityId: id.data,
    metadata: { deleted: true },
  })
  revalidatePath('/admin/team')
  return { ok: true as const }
}
