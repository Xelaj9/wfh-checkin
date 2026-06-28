import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AdjustmentForm } from '@/components/employee/adjustment-form'

const STATUS_LABEL: Record<string, string> = {
  pending: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธ',
}

export default async function AdjustmentPage() {
  const user = await requireUser()
  const supabase = createClient()

  const { data: requests } = await supabase
    .from('adjustment_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-5">
      <AdjustmentForm userId={user.id} />

      <section className="space-y-2">
        <h3 className="font-semibold">คำขอของฉัน</h3>
        {(!requests || requests.length === 0) && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">
            ยังไม่มีคำขอ
          </p>
        )}
        {requests?.map((r) => (
          <div key={r.id} className="rounded-xl border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.target_date}</span>
              <span
                className={`badge ${
                  r.status === 'approved'
                    ? 'badge-normal'
                    : r.status === 'rejected'
                      ? 'badge-suspicious'
                      : 'badge-pending'
                }`}
              >
                {STATUS_LABEL[r.status]}
              </span>
            </div>
            <p className="mt-1 text-slate-500">{r.reason}</p>
            {r.admin_note && (
              <p className="mt-1 text-xs text-slate-400">หมายเหตุแอดมิน: {r.admin_note}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
