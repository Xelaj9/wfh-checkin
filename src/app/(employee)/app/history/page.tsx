import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { timeInTz, formatMinutes } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

export default async function HistoryPage() {
  const user = await requireUser()
  const supabase = createClient()

  // RLS บังคับให้เห็นเฉพาะของตัวเองอยู่แล้ว
  const { data: records } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', user.id)
    .order('work_date', { ascending: false })
    .limit(30)

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">ประวัติการเข้างาน</h2>
      {(!records || records.length === 0) && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">
          ยังไม่มีประวัติ
        </p>
      )}
      {records?.map((r) => (
        <div key={r.id} className="rounded-xl border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{r.work_date}</span>
            <StatusBadge status={r.status} />
          </div>
          <div className="mt-1 flex gap-4 text-slate-500">
            <span>เข้า {r.check_in_time ? timeInTz(DEFAULT_TZ, r.check_in_time) : '-'}</span>
            <span>ออก {r.check_out_time ? timeInTz(DEFAULT_TZ, r.check_out_time) : '-'}</span>
            <span>{formatMinutes(r.worked_minutes)}</span>
          </div>
          {r.is_late && <span className="text-xs text-amber-600">มาสาย</span>}
        </div>
      ))}
    </div>
  )
}
