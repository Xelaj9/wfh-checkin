import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { workDateInTz, timeInTz, formatMinutes } from '@/lib/utils'
import { getSettings } from '@/lib/settings'
import { CheckInPanel } from '@/components/employee/check-in-panel'
import { PresenceCheckBanner } from '@/components/employee/presence-check-banner'
import { WorkLogSection } from '@/components/employee/work-log-section'
import { StatusBadge } from '@/components/ui/status-badge'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

export default async function EmployeeHome() {
  const user = await requireUser()
  const supabase = createClient()
  const settings = await getSettings()

  const { data: team } = await supabase
    .from('teams')
    .select('timezone')
    .eq('id', user.team_id ?? '')
    .maybeSingle()
  const tz = team?.timezone ?? DEFAULT_TZ
  const workDate = workDateInTz(tz)

  const { data: today } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', user.id)
    .eq('work_date', workDate)
    .maybeSingle()

  // presence check ที่ยังค้างและไม่หมดเวลา
  const { data: pendingPresence } = await supabase
    .from('presence_checks')
    .select('id, respond_by')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .gt('respond_by', new Date().toISOString())
    .order('respond_by', { ascending: true })
    .limit(1)
    .maybeSingle()

  // work logs ของวันนี้
  const { data: logs } = await supabase
    .from('work_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('attendance_id', today?.id ?? '')
    .order('created_at', { ascending: true })

  const state = !today?.check_in_time
    ? 'not_checked_in'
    : !today.check_out_time
      ? 'working'
      : 'checked_out'

  return (
    <div className="space-y-5">
      {/* presence check ที่ต้องยืนยัน (ถ้ามี) */}
      {pendingPresence && (
        <PresenceCheckBanner
          pending={{ id: pendingPresence.id, respondBy: pendingPresence.respond_by }}
          userId={user.id}
          selfieRequired={settings.selfie_required}
        />
      )}

      {/* สถานะวันนี้ */}
      <section className="rounded-2xl border bg-slate-50 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">สถานะวันนี้</h2>
          {today && <StatusBadge status={today.status} />}
        </div>
        <p className="mt-2 text-2xl font-bold">
          {state === 'not_checked_in' && 'ยังไม่เช็คอิน'}
          {state === 'working' && 'กำลังทำงาน'}
          {state === 'checked_out' && 'เช็คเอาต์แล้ว'}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-slate-400">เข้างาน</dt>
            <dd className="font-medium">
              {today?.check_in_time ? timeInTz(tz, today.check_in_time) : '-'}
              {today?.is_late && <span className="ml-1 text-amber-600">(สาย)</span>}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">เลิกงาน</dt>
            <dd className="font-medium">
              {today?.check_out_time ? timeInTz(tz, today.check_out_time) : '-'}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-slate-400">เวลาทำงานรวม</dt>
            <dd className="font-medium">{formatMinutes(today?.worked_minutes ?? null)}</dd>
          </div>
        </dl>
      </section>

      {/* ปุ่ม check-in / check-out + ฟอร์ม */}
      <CheckInPanel state={state} selfieRequired={settings.selfie_required} userId={user.id} />

      {/* บันทึกงานระหว่างวัน (แสดงเมื่อเช็คอินแล้ว) */}
      {state !== 'not_checked_in' && <WorkLogSection logs={logs ?? []} />}
    </div>
  )
}
