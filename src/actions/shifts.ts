'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

async function requireAdmin() {
  const me = await getCurrentUser()
  if (!me || (me.role !== 'admin' && me.role !== 'super_admin')) throw new Error('ไม่มีสิทธิ์')
  return me
}

const shiftSchema = z.object({
  name: z.string().min(1).max(50),
  startTime: z.string().regex(TIME),
  endTime: z.string().regex(TIME),
  lateGraceMinutes: z.number().int().min(0).max(120),
})

/** สร้างกะใหม่ (จำกัดสูงสุด 6 กะ) */
export async function createShiftAction(input: unknown) {
  const me = await requireAdmin()
  const parsed = shiftSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลกะไม่ถูกต้อง (เวลาเป็น HH:MM)' }
  const d = parsed.data

  const supabase = createClient()
  const { count } = await supabase
    .from('shifts')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
  if ((count ?? 0) >= 6) return { ok: false as const, error: 'มีกะครบ 6 กะแล้ว (สูงสุด)' }

  const { error } = await supabase.from('shifts').insert({
    name: d.name,
    start_time: d.startTime,
    end_time: d.endTime,
    late_grace_minutes: d.lateGraceMinutes,
    created_by: me.id,
  } as never)
  if (error) return { ok: false as const, error: 'สร้างกะไม่สำเร็จ' }

  await writeAudit({ action: 'setting_updated', actorId: me.id, entityType: 'shift', metadata: { created: d.name } })
  revalidatePath('/admin/team')
  return { ok: true as const }
}

const updateSchema = shiftSchema.extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
})

/** แก้ไขกะ */
export async function updateShiftAction(input: unknown) {
  const me = await requireAdmin()
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลกะไม่ถูกต้อง' }
  const d = parsed.data

  const supabase = createClient()
  const { error } = await supabase
    .from('shifts')
    .update({
      name: d.name,
      start_time: d.startTime,
      end_time: d.endTime,
      late_grace_minutes: d.lateGraceMinutes,
      ...(d.isActive !== undefined ? { is_active: d.isActive } : {}),
    } as never)
    .eq('id', d.id)
  if (error) return { ok: false as const, error: 'แก้ไขกะไม่สำเร็จ' }

  await writeAudit({ action: 'setting_updated', actorId: me.id, entityType: 'shift', entityId: d.id })
  revalidatePath('/admin/team')
  return { ok: true as const }
}

/** ลบกะ (soft delete + ปลดพนักงานที่ผูกกะนี้) */
export async function deleteShiftAction(input: unknown) {
  const me = await requireAdmin()
  const id = z.string().uuid().safeParse((input as { id?: string })?.id)
  if (!id.success) return { ok: false as const, error: 'ข้อมูลไม่ถูกต้อง' }

  const admin = createAdminClient()
  await admin.from('users').update({ shift_id: null } as never).eq('shift_id', id.data)
  const { error } = await admin
    .from('shifts')
    .update({ deleted_at: new Date().toISOString(), is_active: false } as never)
    .eq('id', id.data)
  if (error) return { ok: false as const, error: 'ลบกะไม่สำเร็จ' }

  await writeAudit({ action: 'setting_updated', actorId: me.id, entityType: 'shift', entityId: id.data, metadata: { deleted: true } })
  revalidatePath('/admin/team')
  return { ok: true as const }
}

const assignSchema = z.object({
  userId: z.string().uuid(),
  shiftId: z.string().uuid().nullable(),
})

/** จับพนักงานเข้ากะ (admin จำกัดเฉพาะทีมตัวเอง) */
export async function assignShiftAction(input: unknown) {
  const me = await requireAdmin()
  const parsed = assignSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลไม่ถูกต้อง' }
  const { userId, shiftId } = parsed.data

  const admin = createAdminClient()
  // ตรวจขอบเขตทีม (admin ทั่วไป assign ได้เฉพาะคนในทีมตัวเอง)
  if (me.role !== 'super_admin') {
    const { data: target } = await admin.from('users').select('team_id').eq('id', userId).maybeSingle()
    if (!target || target.team_id !== me.team_id) return { ok: false as const, error: 'อยู่นอกขอบเขตทีม' }
  }

  const { error } = await admin.from('users').update({ shift_id: shiftId } as never).eq('id', userId)
  if (error) return { ok: false as const, error: 'จับกะไม่สำเร็จ' }

  await writeAudit({ action: 'setting_updated', actorId: me.id, entityType: 'user_shift', entityId: userId, metadata: { shiftId } })
  revalidatePath('/admin/team')
  return { ok: true as const }
}
