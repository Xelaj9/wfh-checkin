import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { LeaveDecision } from '@/components/admin/leave-decision'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: 'รออนุมัติ', cls: 'badge-pending' },
  approved: { label: 'อนุมัติแล้ว', cls: 'badge-normal' },
  rejected: { label: 'ปฏิเสธ', cls: 'badge-suspicious' },
}

export default async function AdminLeavesPage() {
  await requireRole(['admin', 'super_admin'])
  const supabase = createClient()
  const settings = await getSettings()

  // RLS จำกัดขอบเขตทีมให้แล้ว
  const { data: requests } = await supabase
    .from('leave_requests')
    .select('*, users!leave_requests_user_id_fkey(full_name, email)')
    .is('deleted_at', null)
    .order('status', { ascending: false }) // pending มาก่อน (r > a)
    .order('leave_date', { ascending: true })
    .limit(100)

  // นับจำนวนอนุมัติแล้วของแต่ละวัน (โชว์ X/max ให้แอดมินเห็นก่อนกด)
  const approvedByDate = new Map<string, number>()
  for (const r of requests ?? []) {
    if (r.status === 'approved') {
      approvedByDate.set(r.leave_date, (approvedByDate.get(r.leave_date) ?? 0) + 1)
    }
  }

  const pending = (requests ?? []).filter((r) => r.status === 'pending')
  const decided = (requests ?? []).filter((r) => r.status !== 'pending').slice(0, 30)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">คำขอวันลา</h1>
        <p className="text-sm text-muted">
          กติกา: ยื่นล่วงหน้า ≥ {settings.min_leave_advance_days} วัน · ≤ {settings.max_leaves_per_month} ครั้ง/เดือน ·
          ลาซ้ำวันได้ ≤ {settings.max_concurrent_leaves} คน (แก้ได้ที่หน้าตั้งค่า)
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">รออนุมัติ ({pending.length})</h2>
        {pending.length === 0 && (
          <p className="rounded-xl border border-dashed bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-400">
            ไม่มีคำขอค้าง
          </p>
        )}
        {pending.map((r) => {
          const u = (r as { users?: { full_name?: string; email?: string } }).users
          const sameDay = approvedByDate.get(r.leave_date) ?? 0
          const full = sameDay >= settings.max_concurrent_leaves
          return (
            <div key={r.id} className="rounded-xl border bg-white dark:bg-slate-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{u?.full_name ?? u?.email}</p>
                  <p className="text-sm text-slate-500">
                    ลาวันที่ <b>{r.leave_date}</b>
                    <span className={`ml-2 text-xs ${full ? 'text-red-600' : 'text-slate-400'}`}>
                      (วันนั้นอนุมัติแล้ว {sameDay}/{settings.max_concurrent_leaves} คน{full ? ' — เต็ม' : ''})
                    </span>
                  </p>
                </div>
                <span className="badge badge-pending">รออนุมัติ</span>
              </div>
              {r.reason && <p className="mt-1 text-sm text-slate-500">เหตุผล: {r.reason}</p>}
              <div className="mt-3">
                <LeaveDecision id={r.id} />
              </div>
            </div>
          )
        })}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">ประวัติล่าสุด</h2>
        <div className="overflow-hidden rounded-xl border bg-white dark:bg-slate-900">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {decided.map((r) => {
                const u = (r as { users?: { full_name?: string; email?: string } }).users
                const st = STATUS_LABEL[r.status] ?? { label: r.status, cls: 'badge-pending' }
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium">{u?.full_name ?? u?.email}</td>
                    <td className="px-4 py-2">{r.leave_date}</td>
                    <td className="px-4 py-2">
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-400">{r.admin_note ?? ''}</td>
                  </tr>
                )
              })}
              {decided.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400">ยังไม่มีประวัติ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
