import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatMinutes } from '@/lib/utils'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

function currentMonth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TZ, year: 'numeric', month: '2-digit' })
    .format(new Date())
    .slice(0, 7)
}

/** นาทีของวัน (ตาม timezone) จาก ISO timestamp */
function minutesOfDay(iso: string): number {
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: DEFAULT_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
function fmtMinAsTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

interface Stat {
  present: number
  late: number
  workedMin: number
  flagged: number
  missed: number
  inMinutes: number[]
}

export default async function StatsPage({ searchParams }: { searchParams: { month?: string } }) {
  await requireRole(['admin', 'super_admin'])
  const supabase = createClient()
  const admin = createAdminClient()

  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? '') ? searchParams.month! : currentMonth()
  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${month}-${String(lastDay).padStart(2, '0')}`

  // RLS จำกัดขอบเขตทีมให้แล้ว
  const [{ data: employees }, { data: records }, { data: missed }] = await Promise.all([
    supabase.from('users').select('id, full_name, email').eq('role', 'employee').eq('is_active', true),
    supabase
      .from('attendance_records')
      .select('user_id, check_in_time, is_late, worked_minutes, status')
      .gte('work_date', start)
      .lte('work_date', end),
    admin
      .from('presence_checks')
      .select('user_id')
      .eq('status', 'missed')
      .gte('scheduled_at', `${start}T00:00:00Z`)
      .lte('scheduled_at', `${end}T23:59:59Z`),
  ])

  const stats = new Map<string, Stat>()
  const get = (id: string) => {
    if (!stats.has(id)) stats.set(id, { present: 0, late: 0, workedMin: 0, flagged: 0, missed: 0, inMinutes: [] })
    return stats.get(id)!
  }
  for (const r of records ?? []) {
    if (!r.check_in_time) continue
    const s = get(r.user_id)
    s.present++
    if (r.is_late) s.late++
    if (r.worked_minutes) s.workedMin += r.worked_minutes
    if (r.status === 'suspicious' || r.status === 'pending_review') s.flagged++
    s.inMinutes.push(minutesOfDay(r.check_in_time))
  }
  for (const p of missed ?? []) get(p.user_id).missed++

  const rows = (employees ?? [])
    .map((e) => ({ e, s: stats.get(e.id) }))
    .sort((a, b) => (b.s?.present ?? 0) - (a.s?.present ?? 0))

  // เดือนก่อนหน้า/ถัดไป สำหรับปุ่มเลื่อน
  const prev = new Date(y, m - 2, 1)
  const next = new Date(y, m, 1)
  const toMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">สถิติพนักงาน</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/admin/stats?month=${toMonth(prev)}`} className="btn-ghost px-3 py-1.5">←</Link>
          <span className="min-w-[5rem] text-center font-medium">{month}</span>
          <Link href={`/admin/stats?month=${toMonth(next)}`} className="btn-ghost px-3 py-1.5">→</Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="surface-muted text-left text-muted">
            <tr>
              <th className="px-4 py-2.5">พนักงาน</th>
              <th className="px-3 py-2.5 text-center">มาทำงาน</th>
              <th className="px-3 py-2.5 text-center">มาสาย</th>
              <th className="px-3 py-2.5 text-center">ตรงเวลา</th>
              <th className="px-3 py-2.5 text-center">เข้าเฉลี่ย</th>
              <th className="px-3 py-2.5 text-center">ชม.รวม</th>
              <th className="px-3 py-2.5 text-center">ผิดปกติ</th>
              <th className="px-3 py-2.5 text-center">ไม่ตอบสุ่ม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
            {rows.map(({ e, s }) => {
              const present = s?.present ?? 0
              const late = s?.late ?? 0
              const onTimeRate = present > 0 ? Math.round(((present - late) / present) * 100) : null
              const avgIn = s && s.inMinutes.length > 0 ? fmtMinAsTime(s.inMinutes.reduce((a, b) => a + b, 0) / s.inMinutes.length) : '-'
              return (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 font-medium">{e.full_name ?? e.email}</td>
                  <td className="px-3 py-2.5 text-center">{present}</td>
                  <td className={`px-3 py-2.5 text-center ${late > 0 ? 'text-amber-600' : ''}`}>{late}</td>
                  <td className="px-3 py-2.5 text-center">
                    {onTimeRate == null ? '-' : (
                      <span className={onTimeRate >= 90 ? 'text-green-600' : onTimeRate >= 70 ? 'text-amber-600' : 'text-red-600'}>{onTimeRate}%</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">{avgIn}</td>
                  <td className="px-3 py-2.5 text-center">{formatMinutes(s?.workedMin ?? 0)}</td>
                  <td className={`px-3 py-2.5 text-center ${(s?.flagged ?? 0) > 0 ? 'text-red-600' : ''}`}>{s?.flagged ?? 0}</td>
                  <td className={`px-3 py-2.5 text-center ${(s?.missed ?? 0) > 0 ? 'text-red-600' : ''}`}>{s?.missed ?? 0}</td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">ไม่มีพนักงาน</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        สถิติคำนวณจากข้อมูลเดือน {month} · “ตรงเวลา” = สัดส่วนวันที่ไม่มาสาย · “ชม.รวม” = เวลาทำงานสะสม
      </p>
    </div>
  )
}
