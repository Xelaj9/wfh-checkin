import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { workDateInTz } from '@/lib/utils'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone ?? ''}`}>{value}</p>
    </div>
  )
}

export default async function AdminDashboard() {
  await requireRole(['admin', 'super_admin'])
  const supabase = createClient()
  const workDate = workDateInTz(DEFAULT_TZ)

  // RLS จำกัดขอบเขตทีมให้อัตโนมัติ (admin เห็นเฉพาะทีมตัวเอง / super_admin เห็นหมด)
  const { data: totalUsers } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'employee')
    .eq('is_active', true)

  const { data: todayRecords } = await supabase
    .from('attendance_records')
    .select('id, status, check_in_time, check_out_time, is_late')
    .eq('work_date', workDate)

  const recs = todayRecords ?? []
  const checkedIn = recs.filter((r) => r.check_in_time).length
  const checkedOut = recs.filter((r) => r.check_out_time).length
  const late = recs.filter((r) => r.is_late).length
  const suspicious = recs.filter((r) => r.status === 'suspicious').length
  const pending = recs.filter((r) => r.status === 'pending_review').length

  // นับพนักงานทั้งหมด (count อยู่ใน response header → ใช้ select count)
  const { count: employeeCount } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'employee')
    .eq('is_active', true)

  const notCheckedIn = (employeeCount ?? 0) - checkedIn

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">ภาพรวมวันนี้</h1>
        <p className="text-sm text-slate-500">{workDate}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="พนักงานทั้งหมด" value={employeeCount ?? 0} />
        <StatCard label="เช็คอินแล้ว" value={checkedIn} tone="text-green-600" />
        <StatCard label="ยังไม่เข้างาน" value={Math.max(0, notCheckedIn)} tone="text-slate-500" />
        <StatCard label="มาสาย" value={late} tone="text-amber-600" />
        <StatCard label="เช็คเอาต์แล้ว" value={checkedOut} />
        <StatCard label="ผิดปกติวันนี้" value={suspicious} tone="text-red-600" />
      </div>

      {pending > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          มี {pending} รายการรอตรวจสอบวันนี้ —{' '}
          <a href="/admin/attendance?status=pending_review" className="font-semibold underline">
            ดูรายการ
          </a>
        </div>
      )}

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-sm text-slate-500">
        ไปที่เมนู <a href="/admin/attendance" className="font-medium text-slate-900 dark:text-slate-100 underline">การเข้างาน</a>{' '}
        เพื่อดูตารางรายวันแบบเต็มพร้อม filter (มาสาย / ยังไม่เข้างาน / ผิดปกติ / ตามพนักงาน)
      </div>
    </div>
  )
}
