import { requireRole } from '@/lib/auth'
import { workDateInTz } from '@/lib/utils'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

export default async function ReportsPage() {
  await requireRole(['admin', 'super_admin'])
  const today = workDateInTz(DEFAULT_TZ)
  // ค่าเริ่มต้น: ต้นเดือนปัจจุบัน
  const monthStart = today.slice(0, 8) + '01'

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">รายงาน</h1>
      <p className="text-sm text-slate-500">เลือกช่วงวันที่แล้วดาวน์โหลดเป็น CSV (เปิดใน Excel ได้)</p>

      <form
        action="/api/reports/attendance"
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-white dark:bg-slate-900 p-4"
      >
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">ตั้งแต่</span>
          <input type="date" name="from" defaultValue={monthStart} className="rounded-lg border px-3 py-1.5" required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">ถึง</span>
          <input type="date" name="to" defaultValue={today} className="rounded-lg border px-3 py-1.5" required />
        </label>
        <button className="rounded-lg bg-slate-900 dark:bg-brand-600 px-4 py-2 text-sm font-medium text-white">
          ดาวน์โหลด CSV
        </button>
      </form>

      <p className="text-xs text-slate-400">
        รายงานเชิงลึก (รายสัปดาห์/เดือน, ขาดงาน, missed presence check) จะเพิ่มใน Phase ถัดไป
      </p>
    </div>
  )
}
