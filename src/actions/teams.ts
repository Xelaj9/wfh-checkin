'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { writeAudit } from '@/lib/audit'

const schema = z.object({
  teamId: z.string().uuid(),
  name: z.string().min(1).max(100),
  workStart: z.string().regex(/^\d{2}:\d{2}$/),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/),
  lateGraceMinutes: z.number().int().min(0).max(120),
})

/** ตั้งค่ากะของทีม: เวลาเข้า–เลิก + ระยะผ่อนผันสาย (เฉพาะ super_admin) */
export async function updateTeamAction(input: unknown) {
  const me = await getCurrentUser()
  if (!me || me.role !== 'super_admin') return { ok: false as const, error: 'เฉพาะ Super Admin เท่านั้น' }

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลเวลาไม่ถูกต้อง' }
  const d = parsed.data

  if (d.workEnd <= d.workStart) return { ok: false as const, error: 'เวลาเลิกต้องหลังเวลาเข้า' }

  // session client → RLS teams_write บังคับ super_admin
  const supabase = createClient()
  const { error } = await supabase
    .from('teams')
    .update({
      name: d.name,
      work_start: d.workStart,
      work_end: d.workEnd,
      late_grace_minutes: d.lateGraceMinutes,
    } as never)
    .eq('id', d.teamId)

  if (error) return { ok: false as const, error: 'บันทึกไม่สำเร็จ' }

  await writeAudit({
    action: 'setting_updated',
    actorId: me.id,
    actorEmail: me.email,
    entityType: 'team',
    entityId: d.teamId,
    metadata: { workStart: d.workStart, workEnd: d.workEnd, lateGrace: d.lateGraceMinutes },
  })

  revalidatePath('/admin/team')
  return { ok: true as const }
}
