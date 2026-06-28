'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientIp, writeAudit } from '@/lib/audit'

const ackSchema = z.object({
  presenceId: z.string().uuid(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  accuracy: z.number().nullable(),
  selfiePath: z.string().optional(),
})

/**
 * พนักงานกดยืนยันตัวตนเมื่อถูกสุ่ม (random presence check)
 * เก็บ location / IP / optional selfie — ผ่าน service role (client เขียน presence_checks ไม่ได้)
 */
export async function acknowledgePresenceAction(input: unknown) {
  const user = await getCurrentUser()
  if (!user) return { ok: false as const, error: 'ยังไม่ได้เข้าสู่ระบบ' }

  const parsed = ackSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลไม่ถูกต้อง' }
  const d = parsed.data

  const admin = createAdminClient()
  const { data: pc } = await admin
    .from('presence_checks')
    .select('*')
    .eq('id', d.presenceId)
    .maybeSingle()

  if (!pc || pc.user_id !== user.id) return { ok: false as const, error: 'ไม่พบรายการ' }
  if (pc.status !== 'pending') return { ok: false as const, error: 'รายการนี้ถูกดำเนินการแล้ว' }
  if (new Date() > new Date(pc.respond_by)) {
    return { ok: false as const, error: 'หมดเวลายืนยันแล้ว' }
  }

  const { error } = await admin
    .from('presence_checks')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      ack_lat: d.lat,
      ack_lng: d.lng,
      ack_ip: getClientIp(),
      ack_selfie_path: d.selfiePath ?? null,
    } as never)
    .eq('id', d.presenceId)

  if (error) return { ok: false as const, error: 'บันทึกไม่สำเร็จ' }

  await writeAudit({
    action: 'presence_acknowledged',
    actorId: user.id,
    actorEmail: user.email,
    entityType: 'presence_check',
    entityId: d.presenceId,
  })

  revalidatePath('/app')
  return { ok: true as const }
}
