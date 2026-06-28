import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { writeAudit } from '@/lib/audit'

/**
 * Export รายงานการเข้างานเป็น CSV
 * - ตรวจ auth + role (admin/super_admin)
 * - RLS จำกัดขอบเขตทีมให้อัตโนมัติ (admin เห็นเฉพาะทีมตัวเอง)
 * - บันทึก audit log ทุกครั้งที่ export
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ error: 'ต้องระบุช่วงวันที่ (from, to)' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: records } = await supabase
    .from('attendance_records')
    .select('*, users(full_name, email)')
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date', { ascending: false })

  const header = [
    'วันที่',
    'พนักงาน',
    'อีเมล',
    'เข้างาน',
    'เลิกงาน',
    'นาทีรวม',
    'มาสาย',
    'อยู่ในพื้นที่',
    'risk_score',
    'สถานะ',
  ]

  const rows = (records ?? []).map((r) => {
    const u = (r as { users?: { full_name?: string; email?: string } }).users
    return [
      r.work_date,
      u?.full_name ?? '',
      u?.email ?? '',
      r.check_in_time ?? '',
      r.check_out_time ?? '',
      r.worked_minutes ?? '',
      r.is_late ? 'สาย' : '',
      r.check_in_within_geofence === false ? 'นอกพื้นที่' : '',
      r.risk_score,
      r.status,
    ]
  })

  // CSV + BOM เพื่อให้ Excel อ่านภาษาไทยถูกต้อง
  const csv =
    '﻿' +
    [header, ...rows]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')

  await writeAudit({
    action: 'report_exported',
    actorId: user.id,
    actorEmail: user.email,
    metadata: { from, to, count: rows.length },
  })

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance_${from}_${to}.csv"`,
    },
  })
}
