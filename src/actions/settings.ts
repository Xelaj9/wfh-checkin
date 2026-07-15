'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

// schema ของ setting ที่อนุญาตให้แก้ (กันยัด key มั่ว)
const settingsSchema = z.object({
  selfie_required: z.boolean(),
  block_checkin_without_location: z.boolean(),
  presence_checks_per_day: z.number().int().min(0).max(6),
  presence_response_minutes: z.number().int().min(3).max(60),
  default_geofence_radius: z.number().int().min(50).max(2000),
  max_checkins_per_day: z.number().int().min(1).max(10),
  data_retention_days: z.number().int().min(30).max(3650),
})

/** super_admin แก้ค่าตั้งค่าระบบ (พร้อม audit log) */
export async function updateSettingsAction(input: unknown) {
  const me = await getCurrentUser()
  if (!me || me.role !== 'super_admin') return { ok: false as const, error: 'ไม่มีสิทธิ์' }

  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'ค่าตั้งค่าไม่ถูกต้อง' }

  const admin = createAdminClient()
  const rows = Object.entries(parsed.data).map(([key, value]) => ({
    key,
    value: value as never,
    updated_by: me.id,
  }))

  const { error } = await admin.from('app_settings').upsert(rows as never, { onConflict: 'key' })
  if (error) return { ok: false as const, error: 'บันทึกไม่สำเร็จ' }

  await writeAudit({
    action: 'setting_updated',
    actorId: me.id,
    actorEmail: me.email,
    entityType: 'app_settings',
    metadata: parsed.data,
  })

  revalidatePath('/admin/settings')
  return { ok: true as const }
}
