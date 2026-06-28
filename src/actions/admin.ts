'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

/** ตรวจว่าผู้เรียกเป็น admin/super_admin และมีสิทธิ์เห็น target user (ขอบเขตทีม) */
async function assertAdminCanManage(targetUserId: string) {
  const me = await getCurrentUser()
  if (!me || (me.role !== 'admin' && me.role !== 'super_admin')) {
    throw new Error('ไม่มีสิทธิ์')
  }
  if (me.role === 'admin') {
    // ตรวจว่า target อยู่ทีมเดียวกัน (ใช้ client ผูก session → RLS บังคับขอบเขต)
    const supabase = createClient()
    const { data } = await supabase.from('users').select('id').eq('id', targetUserId).maybeSingle()
    if (!data) throw new Error('อยู่นอกขอบเขตทีม')
  }
  return me
}

const deviceActionSchema = z.object({
  deviceId: z.string().uuid(),
  userId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  label: z.string().max(100).optional(),
})

/** อนุมัติ / ปฏิเสธอุปกรณ์ใหม่ */
export async function decideDeviceAction(input: unknown) {
  const parsed = deviceActionSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลไม่ถูกต้อง' }
  const { deviceId, userId, decision, label } = parsed.data

  const me = await assertAdminCanManage(userId)
  const admin = createAdminClient()

  const { error } = await admin
    .from('registered_devices')
    .update({
      status: decision,
      label: label ?? undefined,
      approved_by: me.id,
      approved_at: decision === 'approved' ? new Date().toISOString() : null,
    } as never)
    .eq('id', deviceId)

  if (error) return { ok: false as const, error: 'บันทึกไม่สำเร็จ' }

  await writeAudit({
    action: decision === 'approved' ? 'device_approved' : 'device_rejected',
    actorId: me.id,
    actorEmail: me.email,
    entityType: 'device',
    entityId: deviceId,
    metadata: { targetUser: userId },
  })

  // แจ้งเตือนพนักงาน
  await admin.from('notifications').insert({
    user_id: userId,
    type: decision === 'approved' ? 'device_approved' : 'device_rejected',
    title: decision === 'approved' ? 'อุปกรณ์ได้รับการอนุมัติ' : 'อุปกรณ์ถูกปฏิเสธ',
    body:
      decision === 'approved'
        ? 'อุปกรณ์ของคุณได้รับการอนุมัติ สามารถเช็คอินได้ตามปกติ'
        : 'อุปกรณ์ของคุณถูกปฏิเสธ กรุณาติดต่อผู้ดูแล',
  } as never)

  revalidatePath('/admin/devices')
  return { ok: true as const }
}
