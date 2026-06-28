'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { workDateInTz } from '@/lib/utils'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

const addSchema = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().max(2000).optional(),
  status: z.enum(['planned', 'in_progress', 'done', 'blocked']).default('planned'),
})

/** เพิ่ม work log ระหว่างวัน (ผูกกับ attendance ของวันนี้ถ้ามี) */
export async function addWorkLogAction(input: unknown) {
  const user = await getCurrentUser()
  if (!user) return { ok: false as const, error: 'ยังไม่ได้เข้าสู่ระบบ' }

  const parsed = addSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'กรอกหัวข้องานก่อน' }
  const d = parsed.data

  const supabase = createClient()
  const workDate = workDateInTz(DEFAULT_TZ)
  const { data: today } = await supabase
    .from('attendance_records')
    .select('id')
    .eq('user_id', user.id)
    .eq('work_date', workDate)
    .maybeSingle()

  // RLS worklogs_insert_self บังคับ user_id = ตัวเอง
  const { error } = await supabase.from('work_logs').insert({
    user_id: user.id,
    attendance_id: today?.id ?? null,
    title: d.title,
    detail: d.detail ?? null,
    status: d.status,
  } as never)

  if (error) return { ok: false as const, error: 'บันทึกไม่สำเร็จ' }
  revalidatePath('/app')
  return { ok: true as const }
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['planned', 'in_progress', 'done', 'blocked']),
})

/** อัปเดตสถานะงาน */
export async function setWorkLogStatusAction(input: unknown) {
  const user = await getCurrentUser()
  if (!user) return { ok: false as const, error: 'ยังไม่ได้เข้าสู่ระบบ' }

  const parsed = statusSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ข้อมูลไม่ถูกต้อง' }

  const supabase = createClient()
  const { error } = await supabase
    .from('work_logs')
    .update({ status: parsed.data.status } as never)
    .eq('id', parsed.data.id)
    .eq('user_id', user.id) // กันแก้ของคนอื่น (RLS ก็บังคับอยู่แล้ว)

  if (error) return { ok: false as const, error: 'อัปเดตไม่สำเร็จ' }
  revalidatePath('/app')
  return { ok: true as const }
}
