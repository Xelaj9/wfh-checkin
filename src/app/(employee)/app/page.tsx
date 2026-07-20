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

  // ทุก "รอบ" ของวันนี้ (รองรับเช็คอินหลายรอบตาม setting)
  const { data: todayRounds } = await supabase
    .from('attendance_records')
    .select('*, shifts(name, start_time, end_time)')
    .eq('user_id', user.id)
    .eq('work_date', workDate)
    .order('check_in_time', { ascending: true })

  const rounds = todayRounds ?? []

  // รอบเปิดค้าง มองย้อน 24 ชม. ข้าม work_date (กะข้ามเที่ยงคืน เช่น 16:00–00:00)
  const { data: openRows } = await supabase
    .from('attendance_records')
    .select('*, shifts(name, start_time, end_time)')
    .eq('user_id', user.id)
    .not('check_in_time', 'is', null)
    .is('check_out_time', null)
    .gte('check_in_time', new Date(Date.now() - 24 * 3600_000).toISOString())
    .order('check_in_time', { ascending: false })
    .limit(1)
  const open = openRows?.[0] ?? null
  const openFromYesterday = open != null && open.work_date !== workDate

  const latest = rounds[rounds.length - 1] ?? null
  const current = open ?? latest
  const maxRounds = settings.max_checkins_per_day
  const totalMinutes = rounds.reduce((sum, r) => sum + (r.worked_minutes ?? 0), 0)
  const firstIn = open?.check_in_time ?? rounds.find((r) => r.check_in_time)?.check_in_time ?? null
  const lastOut = [...rounds].reverse().find((r) => r.check_out_time)?.check_out_time ?? null

  // state: กำลังทำงาน (รวมรอบข้ามคืน) / เช็คอินรอบใหม่ได้ / ครบทุกรอบแล้ว
  const state = open ? 'working' : rounds.length < maxRounds ? 'not_checked_in' : 'checked_out'

  const currentShift = (current as { shifts?: { name?: string; start_time?: string; end_time?: string } } | null)
    ?.shifts

  // กะที่เปิดใช้งาน — ให้พนักงานเลือกตอนเช็คอิน (รองรับวนกะ)
  const { data: shifts } = await supabase
    .from('shifts')
    .select('id, name, start_time, end_time')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('start_time')

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

  // work logs ของวันนี้ (ทุกรอบ)
  const roundIds = rounds.map((r) => r.id)
  const { data: logs } = roundIds.length
    ? await supabase
        .from('work_logs')
        .select('*')
        .eq('user_id', user.id)
        .in('attendance_id', roundIds)
        .order('created_at', { ascending: true })
    : { data: [] }

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
      <section className="rounded-2xl border bg-slate-50 dark:bg-slate-800/50 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">สถานะวันนี้</h2>
          {current && <StatusBadge status={current.status} />}
        </div>
        <p className="mt-2 text-2xl font-bold">
          {state === 'working' && 'กำลังทำงาน'}
          {state === 'not_checked_in' && (rounds.length === 0 ? 'ยังไม่เช็คอิน' : 'พักระหว่างรอบ')}
          {state === 'checked_out' && 'เช็คเอาต์แล้ว'}
        </p>
        {openFromYesterday && (
          <p className="mt-1 text-sm text-amber-600">
            {open!.work_date > workDate
              ? `รอบนี้เป็นกะของวันที่ ${open!.work_date} (เข้าก่อนเวลา) — เช็คเอาต์ได้ตามปกติ`
              : 'รอบนี้เริ่มเมื่อวาน (กะข้ามเที่ยงคืน) — เช็คเอาต์ได้ตามปกติ'}
          </p>
        )}
        {maxRounds > 1 && (
          <p className="mt-1 text-sm text-slate-400">
            รอบวันนี้: {rounds.length}/{maxRounds}
          </p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-slate-400">เข้างาน{rounds.length > 1 ? 'ครั้งแรก' : ''}</dt>
            <dd className="font-medium">
              {firstIn ? timeInTz(tz, firstIn) : '-'}
              {rounds[0]?.is_late && <span className="ml-1 text-amber-600">(สาย)</span>}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">เลิกงาน{rounds.length > 1 ? 'ล่าสุด' : ''}</dt>
            <dd className="font-medium">{lastOut ? timeInTz(tz, lastOut) : '-'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-slate-400">เวลาทำงานรวม</dt>
            <dd className="font-medium">{formatMinutes(totalMinutes > 0 ? totalMinutes : null)}</dd>
          </div>
          {currentShift?.name && (
            <div className="col-span-2">
              <dt className="text-slate-400">กะวันนี้</dt>
              <dd className="font-medium">
                {currentShift.name} ({currentShift.start_time?.slice(0, 5)}–{currentShift.end_time?.slice(0, 5)})
              </dd>
            </div>
          )}
        </dl>

        {/* รายการรอบของวันนี้ (แสดงเมื่อมีมากกว่า 1 รอบ) */}
        {rounds.length > 1 && (
          <ul className="mt-3 space-y-1 border-t border-slate-200/70 pt-3 text-xs text-slate-500 dark:border-slate-700">
            {rounds.map((r, i) => (
              <li key={r.id} className="flex justify-between">
                <span>รอบ {i + 1}</span>
                <span>
                  {r.check_in_time ? timeInTz(tz, r.check_in_time) : '-'} –{' '}
                  {r.check_out_time ? timeInTz(tz, r.check_out_time) : 'กำลังทำงาน'}
                  {r.worked_minutes ? ` (${formatMinutes(r.worked_minutes)})` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ปุ่ม check-in / check-out + ฟอร์ม */}
      <CheckInPanel
        state={state}
        selfieRequired={settings.selfie_required}
        userId={user.id}
        shifts={shifts ?? []}
        defaultShiftId={user.shift_id}
        roundsUsed={rounds.length}
      />

      {/* บันทึกงานระหว่างวัน (แสดงเมื่อเช็คอินแล้ว) */}
      {rounds.length > 0 && <WorkLogSection logs={logs ?? []} />}
    </div>
  )
}
