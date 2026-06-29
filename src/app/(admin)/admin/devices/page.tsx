import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { DeviceDecisionButtons } from '@/components/admin/device-decision-buttons'

// อุปกรณ์ที่รออนุมัติ (กันฝากเพื่อนกดแทน)
export default async function DevicesPage() {
  await requireRole(['admin', 'super_admin'])
  const supabase = createClient()

  const { data: devices } = await supabase
    .from('registered_devices')
    .select('*, users(full_name, email)')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">อุปกรณ์รออนุมัติ</h1>
      <p className="text-sm text-slate-500">
        อนุมัติอุปกรณ์ใหม่ก่อน พนักงานจึงจะเช็คอินแบบ “ปกติ” ได้
      </p>

      {(!devices || devices.length === 0) && (
        <p className="rounded-xl border border-dashed bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-400">
          ไม่มีอุปกรณ์รออนุมัติ
        </p>
      )}

      <div className="space-y-3">
        {devices?.map((d) => {
          const u = (d as { users?: { full_name?: string; email?: string } }).users
          return (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-xl border bg-white dark:bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm">
                <p className="font-medium">{u?.full_name ?? u?.email}</p>
                <p className="text-slate-500">
                  {d.os ?? '-'} · {d.browser ?? '-'} · {d.screen ?? '-'} · {d.timezone ?? '-'}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  fingerprint: {d.fingerprint.slice(0, 16)}…
                </p>
              </div>
              <DeviceDecisionButtons deviceId={d.id} userId={d.user_id} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
