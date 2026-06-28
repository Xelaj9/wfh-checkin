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

  // ใช้ session client → RLS allowed_emails_admin บังคับสิทธิ์
  const supabase = createClient()
  const { error } = await supabase.from('allowed_emails').insert({
    email: d.email.toLowerCase(),
    role: d.role,
    team_id: d.teamId ?? me.team_id,
    full_name: d.fullName ?? null,
    created_by: me.id,
  } as never)

  if (error) return { ok: false as const, error: 'เพิ่มไม่สำเร็จ (อีเมลซ้ำหรือสิทธิ์ไม่พอ)' }

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
