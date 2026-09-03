import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { workDateInTz, timeInTz, formatMinutes } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import { DatePickerNav } from '@/components/admin/date-picker-nav'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

type Filter = 'all' | 'late' | 'not_checked_in' | 'suspicious' | 'pending_review'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'late', label: 'มาสาย' },
  { key: 'not_checked_in', label: 'ยังไม่เข้างาน' },
  { key: 'pending_review', label: 'รอตรวจสอบ' },
  { key: 'suspicious', label: 'ผิดปกติ' },
]

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { date?: string; status?: string }
}) {
  await requireRole(['admin', 'super_admin'])
  const supabase = createClient()
  const date = searchParams.date ?? workDateInTz(DEFAULT_TZ)
  const filter = (searchParams.status as Filter) ?? 'all'

  // ดึงพนักงานในขอบเขต (RLS จำกัดทีมให้แล้ว)
  const { data: employees } = await supabase
    .from('users')
    .select('id, full_name, email')
    .in('role', ['employee', 'admin'])
    .eq('is_active', true)

  const { data: records } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('work_date', date)
    .order('check_in_time', { ascending: true })

  // วันลาที่อนุมัติแล้วของวันนั้น — แสดง "ลา" แทน "ยังไม่เข้างาน"
  const { data: approvedLeaves } = await supabase
    .from('leave_requests')
    .select('user_id')
    .eq('leave_date', date)
    .eq('status', 'approved')
    .is('deleted_at', null)
  const onLeave = new Set((approvedLeaves ?? []).map((l) => l.user_id))

  // รวมหลายรอบ/วันของแต่ละคนเป็นสรุปเดียว (เข้าครั้งแรก–ออกล่าสุด, ชม.รวม, สถานะแย่สุด)
  interface Agg {
    rounds: number
    firstIn: string | null
    lastOut: string | null
    working: boolean // มีรอบที่ยังไม่เช็คเอาต์
    totalMin: number
    isLate: boolean
    maxRisk: number
    status: 'normal' | 'pending_review' | 'suspicious'
    latestId: string
  }
  const RANK = { normal: 0, pending_review: 1, suspicious: 2 } as const
  const byUser = new Map<string, Agg>()
  for (const r of records ?? []) {
    const a = byUser.get(r.user_id) ?? {
      rounds: 0,
      firstIn: null,
      lastOut: null,
      working: false,
      totalMin: 0,
      isLate: false,
      maxRisk: 0,
      status: 'normal' as const,
      latestId: r.id,
    }
    a.rounds++
    if (r.check_in_time && !a.firstIn) a.firstIn = r.check_in_time
    if (r.check_out_time) a.lastOut = r.check_out_time
    if (r.check_in_time && !r.check_out_time) a.working = true
    a.totalMin += r.worked_minutes ?? 0
    a.isLate = a.isLate || r.is_late
    a.maxRisk = Math.max(a.maxRisk, r.risk_score ?? 0)
    if (RANK[r.status as keyof typeof RANK] > RANK[a.status]) a.status = r.status as Agg['status']
    a.latestId = r.id
    byUser.set(r.user_id, a)
  }

  // รวมพนักงาน + สรุปของวันนั้น (รวม "ยังไม่เข้างาน")
  let rows = (employees ?? []).map((e) => ({ employee: e, record: byUser.get(e.id) ?? null }))

  rows = rows.filter(({ employee, record }) => {
    switch (filter) {
      case 'late':
        return record?.isLate
      case 'not_checked_in':
        return !record?.firstIn && !onLeave.has(employee.id)
      case 'suspicious':
        return record?.status === 'suspicious'
      case 'pending_review':
        return record?.status === 'pending_review'
      default:
        return true
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">การเข้างานรายวัน</h1>
        <DatePickerNav value={date} basePath="/admin/attendance" />
      </div>

      {/* filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/attendance?date=${date}&status=${f.key}`}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === f.key ? 'bg-slate-900 dark:bg-brand-600 text-white' : 'bg-white dark:bg-slate-900 border text-slate-600'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">พนักงาน</th>
              <th className="px-4 py-2">เข้างาน</th>
              <th className="px-4 py-2">เลิกงาน</th>
              <th className="px-4 py-2">รวม</th>
              <th className="px-4 py-2">Risk</th>
              <th className="px-4 py-2">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  ไม่มีข้อมูลตามเงื่อนไข
                </td>
              </tr>
            )}
            {rows.map(({ employee, record }) => (
              <tr key={employee.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <td className="px-4 py-2 font-medium">
                  {record ? (
                    <Link href={`/admin/attendance/${record.latestId}`} className="text-slate-900 dark:text-slate-100 hover:underline">
                      {employee.full_name ?? employee.email}
                    </Link>
                  ) : (
                    employee.full_name ?? employee.email
                  )}
                  {record && record.rounds > 1 && (
                    <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {record.rounds} รอบ
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {record?.firstIn ? timeInTz(DEFAULT_TZ, record.firstIn) : '-'}
                  {record?.isLate && <span className="ml-1 text-xs text-amber-600">สาย</span>}
                </td>
                <td className="px-4 py-2">
                  {record?.working ? (
                    <span className="text-xs text-green-600">กำลังทำงาน</span>
                  ) : record?.lastOut ? (
                    timeInTz(DEFAULT_TZ, record.lastOut)
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-4 py-2">{formatMinutes(record?.totalMin ? record.totalMin : null)}</td>
                <td className="px-4 py-2">{record ? record.maxRisk : '-'}</td>
                <td className="px-4 py-2">
                  {record ? (
                    <StatusBadge status={record.status} />
                  ) : onLeave.has(employee.id) ? (
                    <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">ลา (อนุมัติ)</span>
                  ) : (
                    <span className="text-xs text-slate-400">ยังไม่เข้างาน</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
