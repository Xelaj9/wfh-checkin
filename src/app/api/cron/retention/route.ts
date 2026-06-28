import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSettings } from '@/lib/settings'

/**
 * Cron: ลบ/ทำให้ข้อมูลเก่าไม่ระบุตัวตน ตาม retention period (ข้อ 17)
 * - login_history เกินกำหนด → ลบ
 * - attendance เกินกำหนด → ลบพิกัด/IP/selfie path (anonymize) แต่คงสถิติเวลาไว้
 * ต้องส่ง header Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const settings = await getSettings()
  const cutoff = new Date(Date.now() - settings.data_retention_days * 86_400_000)
  const cutoffDate = cutoff.toISOString().slice(0, 10)

  // ลบ login history เก่า
  const { count: loginDeleted } = await admin
    .from('login_history')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff.toISOString())

  // anonymize attendance เก่า (ลบข้อมูล location/ip/selfie)
  const { data: anonymized } = await admin
    .from('attendance_records')
    .update({
      check_in_lat: null,
      check_in_lng: null,
      check_in_ip: null,
      check_in_selfie_path: null,
      check_out_lat: null,
      check_out_lng: null,
      check_out_ip: null,
    } as never)
    .lt('work_date', cutoffDate)
    .not('check_in_lat', 'is', null)
    .select('id')

  return NextResponse.json({
    ok: true,
    cutoffDate,
    loginDeleted: loginDeleted ?? 0,
    attendanceAnonymized: anonymized?.length ?? 0,
  })
}
