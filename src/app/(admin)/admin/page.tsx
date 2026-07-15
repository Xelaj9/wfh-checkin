import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { workDateInTz } from '@/lib/utils'
import { DatePickerNav } from '@/components/admin/date-picker-nav'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

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

  // RLS จำกัดขอบเขตทีมให้อัตโนมัติ (admin เห็นเฉพาะทีมตัวเอง / super_admin เห็นหมด)
  const { data: dayRecords } = await supabase
    .from('attendance_records')
    .select('id, user_id, status, check_in_time, check_out_time, is_late')
    .eq('work_date', workDate)

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

  // นับพนักงานทั้งหมด (count อยู่ใน response header → ใช้ select count)
  const { count: employeeCount } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .in('role', ['employee', 'admin'])
    .eq('is_active', true)

  const notCheckedIn = (employeeCount ?? 0) - checkedIn

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
