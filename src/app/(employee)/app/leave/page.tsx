import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { workDateInTz } from '@/lib/utils'
import { LeaveForm } from '@/components/employee/leave-form'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

export default async function LeavePage() {
  const user = await requireUser()
  const supabase = createClient()
  const settings = await getSettings()

  // คำขอของตัวเอง (RLS บังคับ) — ไม่รวมที่ยกเลิก
  const { data: requests } = await supabase
    .from('leave_requests')
    .select('id, leave_date, reason, status, admin_note')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('leave_date', { ascending: false })
    .limit(30)

  // โควตาเดือนปัจจุบัน (pending + approved)
  const month = workDateInTz(DEFAULT_TZ).slice(0, 7)
  const usedThisMonth = (requests ?? []).filter(
    (r) => r.leave_date.startsWith(month) && (r.status === 'pending' || r.status === 'approved')
  ).length

  return (
    <LeaveForm
      requests={requests ?? []}
      minAdvanceDays={settings.min_leave_advance_days}
      usedThisMonth={usedThisMonth}
      maxPerMonth={settings.max_leaves_per_month}
    />
  )
}
