'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import { getSettings } from '@/lib/settings'
import { workDateInTz } from '@/lib/utils'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** จำนวนวันจากวันนี้ (ตามโซนบริษัท) ถึงวันที่เป้าหมาย */
function daysFromToday(target: string): number {
  const today = workDateInTz(DEFAULT_TZ)
  return Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

// ===========================================================================
// พนักงานยื่นคำขอลา
// ===========================================================================
const requestSchema = z.object({
  leaveDate: z.string().regex(DATE_RE),
  reason: z.string().max(500).optional(),
})

export async function requestLeaveAction(input: unknown) {
  const user = await getCurrentUser()
  if (!user) return { ok: false as const, error: 'ยังไม่ได้เข้าสู่ระบบ' }

  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'กรุณาเลือกวันที่ให้ถูกต้อง' }
  const { leaveDate, reason } = parsed.data

  const settings = await getSettings()

  // กติกา 1: ต้องยื่นล่วงหน้าอย่างน้อย N วัน
  const ahead = daysFromToday(leaveDate)
  if (ahead < settings.min_leave_advance_days) {
    return {
      ok: false as const,
      error: `ต้องยื่นลาล่วงหน้าอย่างน้อย ${settings.min_leave_advance_days} วัน`,
    }
  }

  const admin = createAdminClient()

  // กติกา 2: โควตาต่อเดือน (นับ pending + approved ของเดือนที่ขอลา)
  const month = leaveDate.slice(0, 7)
  const { count: monthCount } = await admin
    .from('leave_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('leave_date', `${month}-01`)
    .lte('leave_date', `${month}-31`)
    .in('status', ['pending', 'approved'])
    .is('deleted_at', null)
  if ((monthCount ?? 0) >= settings.max_leaves_per_month) {
    return {
      ok: false as const,
      error: `เดือนนั้นคุณลาครบ ${settings.max_leaves_per_month} ครั้งแล้ว`,
    }
  }

  // ยื่นผ่าน session client → RLS บังคับ user_id ตัวเอง + สถานะ pending
  const supabase = createClient()
  const { data: created, error } = await supabase
    .from('leave_requests')
    .insert({ user_id: user.id, leave_date: leaveDate, reason: reason || null } as never)
    .select('id')
    .single()

  if (error) {
    // unique index → ยื่นวันเดิมซ้ำ
    return { ok: false as const, error: 'คุณยื่นลาวันนี้ไว้แล้ว (ดูสถานะในรายการด้านล่าง)' }
  }

  await writeAudit({
    action: 'leave_requested',
    actorId: user.id,
    actorEmail: user.email,
    entityType: 'leave',
    entityId: created?.id,
    metadata: { leaveDate },
  })

  revalidatePath('/app/leave')
  return { ok: true as const }
}

// ===========================================================================
// พนักงานยกเลิกคำขอ (ได้เฉพาะ pending ของตัวเอง)
// ===========================================================================
export async function cancelLeaveAction(input: unknown) {
  const user = await getCurrentUser()
  if (!user) return { ok: false as const, error: 'ยังไม่ได้เข้าสู่ระบบ' }
  const id = z.string().uuid().safeParse((input as { id?: string })?.id)
  if (!id.success) return { ok: false as const, error: 'ข้อมูลไม่ถูกต้อง' }

  const admin = createAdminClient()
  const { data: req } = await admin
    .from('leave_requests')
    .select('id, user_id, status')
    .eq('id', id.data)
    .maybeSingle()
  if (!req || req.user_id !== user.id) return { ok: false as const, error: 'ไม่พบคำขอ' }
  if (req.status !== 'pending') return { ok: false as const, error: 'ยกเลิกได้เฉพาะคำขอที่รออนุมัติ' }

  await admin
    .from('leave_requests')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id.data)

  await writeAudit({
    action: 'leave_cancelled',
    actorId: user.id,
    actorEmail: user.email,
    entityType: 'leave',
    entityId: id.data,
  })

  revalidatePath('/app/leave')
  return { ok: true as const }
}

// ===========================================================================
// แอดมินอนุมัติ/ปฏิเสธ
// ===========================================================================
const decideSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  adminNote: z.string().max(500).optional(),
})

export async function decideLeaveAction(input: unknown) {
  const me = await getCurrentUser()
  if (!me || (me.role !== 'admin' && me.role !== 'super_admin')) {
    return { ok: false as const, error: 'ไม่มีสิทธิ์' }
  }

  const parsed = decideSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลไม่ถูกต้อง' }
  const { id, decision, adminNote } = parsed.data

  // อ่านผ่าน session client → RLS จำกัดขอบเขตทีมของ admin
  const supabase = createClient()
  const { data: req } = await supabase
    .from('leave_requests')
    .select('id, user_id, leave_date, status')
    .eq('id', id)
    .maybeSingle()
  if (!req) return { ok: false as const, error: 'ไม่พบคำขอ หรืออยู่นอกขอบเขตทีม' }
  if (req.status !== 'pending') return { ok: false as const, error: 'คำขอนี้ถูกดำเนินการไปแล้ว' }

  const admin = createAdminClient()

  // กติกา 3: ลาซ้ำวันเดียวกันได้ไม่เกิน N คน (นับเฉพาะ approved)
  if (decision === 'approved') {
    const settings = await getSettings()
    const { count: sameDay } = await admin
      .from('leave_requests')
      .select('id', { count: 'exact', head: true })
      .eq('leave_date', req.leave_date)
      .eq('status', 'approved')
      .is('deleted_at', null)
    if ((sameDay ?? 0) >= settings.max_concurrent_leaves) {
      return {
        ok: false as const,
        error: `วันที่ ${req.leave_date} มีคนลาครบ ${settings.max_concurrent_leaves} คนแล้ว — ปฏิเสธหรือให้พนักงานเลื่อนวัน`,
      }
    }
  }

  const { error } = await admin
    .from('leave_requests')
    .update({
      status: decision,
      reviewed_by: me.id,
      reviewed_at: new Date().toISOString(),
      admin_note: adminNote ?? null,
    } as never)
    .eq('id', id)
  if (error) return { ok: false as const, error: 'บันทึกไม่สำเร็จ' }

  await writeAudit({
    action: decision === 'approved' ? 'leave_approved' : 'leave_rejected',
    actorId: me.id,
    actorEmail: me.email,
    entityType: 'leave',
    entityId: id,
    metadata: { targetUser: req.user_id, leaveDate: req.leave_date },
  })

  await admin.from('notifications').insert({
    user_id: req.user_id,
    type: 'leave_result',
    title: decision === 'approved' ? `วันลา ${req.leave_date} ได้รับอนุมัติ` : `วันลา ${req.leave_date} ถูกปฏิเสธ`,
    body: adminNote ?? null,
  } as never)

  revalidatePath('/admin/leaves')
  return { ok: true as const }
}
