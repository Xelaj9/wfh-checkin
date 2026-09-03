import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { workDateInTz } from '@/lib/utils'
import { DatePickerNav } from '@/components/admin/date-picker-nav'
import {
  AttendanceTrendChart,
  AvgCheckInChart,
  EmployeeHoursChart,
  StatusBreakdownBar,
  type DailyPoint,
  type EmployeeHours,
} from '@/components/admin/dashboard-charts'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

/** นาทีของวัน (ตามโซนบริษัท) จาก ISO timestamp */
function minutesOfDay(iso: string): number {
  const s = new Intl.DateTimeFormat('en-GB', { timeZone: DEFAULT_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone ?? ''}`}>{value}</p>
    </div>
  )
}

/** เลื่อนวันที่ (YYYY-MM-DD) ไป n วัน */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  await requireRole(['admin', 'super_admin'])
  const supabase = createClient()

  const today = workDateInTz(DEFAULT_TZ)
  // วันที่จาก query param (validate รูปแบบ ไม่งั้นใช้วันนี้)
  const raw = searchParams.date ?? ''
  const workDate = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today
  const isToday = workDate === today

  // ข้อมูล 30 วันย้อนหลังจากวันที่เลือก (ใช้ทั้งการ์ดสรุปวันเดียว + กราฟแนวโน้ม)
  // RLS จำกัดขอบเขตทีมให้อัตโนมัติ (admin เห็นเฉพาะทีมตัวเอง / super_admin เห็นหมด)
  const fromDate = shiftDate(workDate, -29)
  const [{ data: rangeRecords }, { data: members }] = await Promise.all([
    supabase
      .from('attendance_records')
      .select('id, user_id, work_date, status, check_in_time, check_out_time, is_late, worked_minutes')
      .gte('work_date', fromDate)
      .lte('work_date', workDate)
      .order('check_in_time', { ascending: true }),
    supabase
      .from('users')
      .select('id, full_name, email')
      .in('role', ['employee', 'admin'])
      .eq('is_active', true),
  ])
  const all = rangeRecords ?? []
  const dayRecords = all.filter((r) => r.work_date === workDate)

  // นับเป็น "คน" (ไม่ซ้ำ) — รองรับเช็คอินหลายรอบ/วัน
  const recs = dayRecords ?? []
  const uniq = (xs: (string | null)[]) => new Set(xs.filter(Boolean)).size
  const checkedIn = uniq(recs.filter((r) => r.check_in_time).map((r) => r.user_id))
  // เช็คเอาต์แล้ว = ไม่มีรอบค้างเปิด (คนที่กำลังทำงานไม่นับ)
  const openUsers = new Set(recs.filter((r) => r.check_in_time && !r.check_out_time).map((r) => r.user_id))
  const checkedOut = uniq(recs.filter((r) => r.check_out_time && !openUsers.has(r.user_id)).map((r) => r.user_id))
  const late = uniq(recs.filter((r) => r.is_late).map((r) => r.user_id))
  const suspicious = uniq(recs.filter((r) => r.status === 'suspicious').map((r) => r.user_id))
  const pending = recs.filter((r) => r.status === 'pending_review').length

  const employeeCount = (members ?? []).length
  const notCheckedIn = employeeCount - checkedIn

  // ---------- ข้อมูลกราฟ (ช่วง 30 วันถึงวันที่เลือก) ----------
  // รายวัน: คนตรงเวลา/สาย (นับคนไม่ซ้ำ) + เวลาเข้าเฉลี่ย (รอบแรกของแต่ละคน)
  const daily: DailyPoint[] = []
  for (let i = 0; i < 30; i++) {
    const date = shiftDate(fromDate, i)
    const dayRecs = all.filter((r) => r.work_date === date && r.check_in_time)
    const lateUsers = new Set(dayRecs.filter((r) => r.is_late).map((r) => r.user_id))
    const allUsers = new Set(dayRecs.map((r) => r.user_id))
    const firstIns = new Map<string, number>()
    for (const r of dayRecs) {
      if (!firstIns.has(r.user_id)) firstIns.set(r.user_id, minutesOfDay(r.check_in_time!))
    }
    const ins = [...firstIns.values()]
    daily.push({
      date,
      onTime: allUsers.size - lateUsers.size,
      late: lateUsers.size,
      avgInMin: ins.length ? ins.reduce((a, b) => a + b, 0) / ins.length : null,
    })
  }

  // ต่อพนักงาน: ชั่วโมงรวม + จำนวนวันสาย (top 10)
  const nameOf = new Map((members ?? []).map((m) => [m.id, m.full_name ?? m.email]))
  const perEmp = new Map<string, { minutes: number; lateDates: Set<string> }>()
  for (const r of all) {
    const e = perEmp.get(r.user_id) ?? { minutes: 0, lateDates: new Set<string>() }
    e.minutes += r.worked_minutes ?? 0
    if (r.is_late) e.lateDates.add(r.work_date)
    perEmp.set(r.user_id, e)
  }
  const hoursRows: EmployeeHours[] = [...perEmp.entries()]
    .map(([id, e]) => ({ name: nameOf.get(id) ?? '—', minutes: e.minutes, lateDays: e.lateDates.size }))
    .filter((e) => e.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10)

  // สัดส่วนสถานะรวมทั้งช่วง
  const statusCounts = {
    normal: all.filter((r) => r.status === 'normal').length,
    pending: all.filter((r) => r.status === 'pending_review').length,
    suspicious: all.filter((r) => r.status === 'suspicious').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{isToday ? 'ภาพรวมวันนี้' : 'ภาพรวมย้อนหลัง'}</h1>
          <p className="text-sm text-slate-500">{workDate}</p>
        </div>

        {/* เลือกวันที่: ก่อนหน้า / ปฏิทิน / ถัดไป / วันนี้ */}
        <div className="flex items-center gap-2">
          <Link
            href={`/admin?date=${shiftDate(workDate, -1)}`}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="วันก่อนหน้า"
          >
            ←
          </Link>
          <DatePickerNav value={workDate} max={today} basePath="/admin" />
          <Link
            href={isToday ? '#' : `/admin?date=${shiftDate(workDate, 1)}`}
            aria-disabled={isToday}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              isToday
                ? 'pointer-events-none opacity-40'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            aria-label="วันถัดไป"
          >
            →
          </Link>
          {!isToday && (
            <Link href="/admin" className="rounded-lg bg-slate-900 dark:bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">
              วันนี้
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="พนักงานทั้งหมด" value={employeeCount ?? 0} />
        <StatCard label="เช็คอินแล้ว" value={checkedIn} tone="text-green-600" />
        <StatCard label="ยังไม่เข้างาน" value={Math.max(0, notCheckedIn)} tone="text-slate-500" />
        <StatCard label="มาสาย" value={late} tone="text-amber-600" />
        <StatCard label="เช็คเอาต์แล้ว" value={checkedOut} />
        <StatCard label="ผิดปกติ" value={suspicious} tone="text-red-600" />
      </div>

      {pending > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          มี {pending} รายการรอตรวจสอบ ({workDate}) —{' '}
          <Link href={`/admin/attendance?date=${workDate}&status=pending_review`} className="font-semibold underline">
            ดูรายการ
          </Link>
        </div>
      )}

      {/* ---------- กราฟสถิติ 30 วันล่าสุด (ถึงวันที่เลือก) ---------- */}
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <h2 className="mb-1 font-semibold">คนมาทำงานต่อวัน</h2>
          <p className="mb-3 text-xs text-slate-400">
            30 วันถึง {workDate} · ชี้ที่แท่งเพื่อดูตัวเลข
          </p>
          <AttendanceTrendChart daily={daily} />
        </section>

        <section className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <h2 className="mb-1 font-semibold">เวลาเข้างานเฉลี่ยต่อวัน</h2>
          <p className="mb-3 text-xs text-slate-400">เฉลี่ยจากรอบแรกของแต่ละคน (ยิ่งต่ำ = เข้าเช้ากว่า)</p>
          <AvgCheckInChart daily={daily} />
        </section>

        <section className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <h2 className="mb-1 font-semibold">ชั่วโมงทำงานรวมต่อพนักงาน</h2>
          <p className="mb-3 text-xs text-slate-400">
            30 วันล่าสุด (สูงสุด 10 อันดับ) ·{' '}
            <Link href="/admin/stats" className="underline">
              ดูตารางสถิติเต็มรายเดือน
            </Link>
          </p>
          <EmployeeHoursChart rows={hoursRows} />
        </section>

        <section className="rounded-xl border bg-white dark:bg-slate-900 p-4">
          <h2 className="mb-1 font-semibold">สัดส่วนสถานะการเช็คอิน</h2>
          <p className="mb-3 text-xs text-slate-400">ทุกรอบเช็คอินในช่วง 30 วัน</p>
          <StatusBreakdownBar counts={statusCounts} />
        </section>
      </div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-sm text-slate-500">
        ไปที่เมนู{' '}
        <Link href={`/admin/attendance?date=${workDate}`} className="font-medium text-slate-900 dark:text-slate-100 underline">
          การเข้างาน
        </Link>{' '}
        เพื่อดูตารางรายวันแบบเต็มพร้อม filter (มาสาย / ยังไม่เข้างาน / ผิดปกติ / ตามพนักงาน)
      </div>
    </div>
  )
}
