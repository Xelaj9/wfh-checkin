'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

const createSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestedCheckIn: z.string().optional(), // ISO หรือว่าง
  requestedCheckOut: z.string().optional(),
  reason: z.string().min(5).max(1000),
  evidencePath: z.string().optional(),
})

/** พนักงานส่งคำขอแก้ไขเวลา (ห้ามแก้ attendance ตรง) */
export async function createAdjustmentAction(input: unknown) {
  const user = await getCurrentUser()
  if (!user) return { ok: false as const, error: 'ยังไม่ได้เข้าสู่ระบบ' }

  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลไม่ครบ (เหตุผลอย่างน้อย 5 ตัวอักษร)' }
  const d = parsed.data

  // ใช้ session client → RLS adjustments_insert_self บังคับ user_id = ตัวเอง
  const supabase = createClient()
  const { data: created, error } = await supabase
    .from('adjustment_requests')
    .insert({
      user_id: user.id,
      target_date: d.targetDate,
      requested_check_in: d.requestedCheckIn || null,
      requested_check_out: d.requestedCheckOut || null,
      reason: d.reason,
      evidence_path: d.evidencePath || null,
      status: 'pending',
    } as never)
    .select('id')
    .single()

  if (error) return { ok: false as const, error: 'ส่งคำขอไม่สำเร็จ' }

  await writeAudit({
    action: 'adjustment_requested',
    actorId: user.id,
    actorEmail: user.email,
    entityType: 'adjustment',
    entityId: created?.id,
    metadata: { targetDate: d.targetDate },
  })

  revalidatePath('/app/adjustment')
  return { ok: true as const }
}

const decideSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  adminNote: z.string().max(1000).optional(),
})

/** แอดมินอนุมัติ/ปฏิเสธ — ถ้าอนุมัติจะ apply เวลาเข้า attendance_records ผ่าน service role */
export async function decideAdjustmentAction(input: unknown) {
  const me = await getCurrentUser()
  if (!me || (me.role !== 'admin' && me.role !== 'super_admin')) {
    return { ok: false as const, error: 'ไม่มีสิทธิ์' }
  }

  const parsed = decideSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลไม่ถูกต้อง' }
  const { id, decision, adminNote } = parsed.data

  // ตรวจขอบเขตทีมผ่าน session client (RLS จำกัดให้เห็นเฉพาะทีมตัวเอง)
  const supabase = createClient()
  const { data: req } = await supabase
    .from('adjustment_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!req) return { ok: false as const, error: 'ไม่พบคำขอ หรืออยู่นอกขอบเขตทีม' }
  if (req.status !== 'pending') return { ok: false as const, error: 'คำขอนี้ถูกดำเนินการไปแล้ว' }

  const admin = createAdminClient()

  // อัปเดตสถานะคำขอ
  await admin
    .from('adjustment_requests')
    .update({
      status: decision,
      reviewed_by: me.id,
      reviewed_at: new Date().toISOString(),
      admin_note: adminNote ?? null,
    } as never)
    .eq('id', id)

  // ถ้าอนุมัติ → apply เวลาเข้า attendance
  // (รองรับหลายรอบ/วัน: อัปเดตรอบล่าสุดของวันนั้น ถ้าไม่มีจึงสร้างใหม่)
  if (decision === 'approved') {
    const patch: Record<string, unknown> = { status: 'normal' }
    if (req.requested_check_in) patch.check_in_time = req.requested_check_in
    if (req.requested_check_out) patch.check_out_time = req.requested_check_out

    const { data: existing } = await admin
      .from('attendance_records')
      .select('id')
      .eq('user_id', req.user_id)
      .eq('work_date', req.target_date)
      .order('check_in_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      await admin.from('attendance_records').update(patch as never).eq('id', existing.id)
    } else {
      await admin
        .from('attendance_records')
        .insert({ user_id: req.user_id, work_date: req.target_date, ...patch } as never)
    }
  }

  await writeAudit({
    action: decision === 'approved' ? 'adjustment_approved' : 'adjustment_rejected',
    actorId: me.id,
    actorEmail: me.email,
    entityType: 'adjustment',
    entityId: id,
    metadata: { targetUser: req.user_id, targetDate: req.target_date },
  })

  await admin.from('notifications').insert({
    user_id: req.user_id,
    type: 'adjustment_result',
    title: decision === 'approved' ? 'คำขอแก้เวลาได้รับการอนุมัติ' : 'คำขอแก้เวลาถูกปฏิเสธ',
    body: adminNote ?? null,
  } as never)

  revalidatePath('/admin/adjustments')
  return { ok: true as const }
}
