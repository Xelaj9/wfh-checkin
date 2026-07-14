import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { workDateInTz, timeInTz, formatMinutes } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'

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

  const byUser = new Map((records ?? []).map((r) => [r.user_id, r]))

  // รวมพนักงาน + record ของวันนั้น (รวม "ยังไม่เข้างาน")
  let rows = (employees ?? []).map((e) => ({ employee: e, record: byUser.get(e.id) ?? null }))

  rows = rows.filter(({ record }) => {
    switch (filter) {
      case 'late':
        return record?.is_late
      case 'not_checked_in':
        return !record?.check_in_time
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
        <form>
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="rounded-lg border px-3 py-1.5 text-sm"
          />
          <input type="hidden" name="status" value={filter} />
        </form>
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
                    <Link href={`/admin/attendance/${record.id}`} className="text-slate-900 dark:text-slate-100 hover:underline">
                      {employee.full_name ?? employee.email}
                    </Link>
                  ) : (
                    employee.full_name ?? employee.email
                  )}
                </td>
                <td className="px-4 py-2">
                  {record?.check_in_time ? timeInTz(DEFAULT_TZ, record.check_in_time) : '-'}
                  {record?.is_late && <span className="ml-1 text-xs text-amber-600">สาย</span>}
                </td>
                <td className="px-4 py-2">
                  {record?.check_out_time ? timeInTz(DEFAULT_TZ, record.check_out_time) : '-'}
                </td>
                <td className="px-4 py-2">{formatMinutes(record?.worked_minutes ?? null)}</td>
                <td className="px-4 py-2">{record ? record.risk_score : '-'}</td>
                <td className="px-4 py-2">
                  {record ? <StatusBadge status={record.status} /> : <span className="text-xs text-slate-400">ยังไม่เข้างาน</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
