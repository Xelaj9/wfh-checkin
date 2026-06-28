import { createAdminClient } from '@/lib/supabase/admin'

/** ค่า setting ระดับบริษัท (มี default กันกรณียังไม่ตั้งค่า) */
export interface AppSettings {
  selfie_required: boolean
  block_checkin_without_location: boolean
  presence_checks_per_day: number
  presence_response_minutes: number
  default_geofence_radius: number
  data_retention_days: number
}

const DEFAULTS: AppSettings = {
  selfie_required: false,
  block_checkin_without_location: false,
  presence_checks_per_day: 2,
  presence_response_minutes: 10,
  default_geofence_radius: 200,
  data_retention_days: 365,
}

/** อ่าน settings ทั้งหมดผ่าน service role (ใช้ฝั่ง server) */
export async function getSettings(): Promise<AppSettings> {
  const admin = createAdminClient()
  const { data } = await admin.from('app_settings').select('key, value')
  const result = { ...DEFAULTS }
  for (const row of data ?? []) {
    if (row.key in result) {
      // value เก็บเป็น jsonb → cast ตาม type ของ default
      ;(result as Record<string, unknown>)[row.key] = row.value
    }
  }
  return result
}

export const SETTINGS_DEFAULTS = DEFAULTS
