import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

/**
 * Service-role client — bypass RLS
 * ⚠️ ใช้เฉพาะฝั่ง server เท่านั้น และเฉพาะ action ที่ตรวจ auth/role แล้ว เช่น
 *    - เขียน attendance_records (server เป็นคนตัดสิน status/risk)
 *    - เขียน audit_logs
 *    - อนุมัติอุปกรณ์, ออก signed URL
 * ห้าม import ไฟล์นี้เข้า Client Component เด็ดขาด
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
