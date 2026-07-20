'use client'

import { useEffect, useState, useTransition } from 'react'
import { checkInAction, checkOutAction, type ActionResult } from '@/actions/attendance'
import { collectDeviceSignals, computeFingerprint } from '@/lib/device-fingerprint'
import { SelfieCapture } from '@/components/employee/selfie-capture'

type State = 'not_checked_in' | 'working' | 'checked_out'

interface ShiftOption {
  id: string
  name: string
  start_time: string
  end_time: string
}
const hhmm = (t: string) => t?.slice(0, 5) ?? ''

/** ขอพิกัดจาก browser (เก็บเฉพาะตอนกดเช็คอิน/เอาต์ — ไม่ track ตลอดเวลา) */
function getPosition(): Promise<{ lat: number | null; lng: number | null; accuracy: number | null; denied: boolean }> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ lat: null, lng: null, accuracy: null, denied: true })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          denied: false,
        }),
      () => resolve({ lat: null, lng: null, accuracy: null, denied: true }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}

async function buildDevice() {
  const signals = collectDeviceSignals()
  const fingerprint = await computeFingerprint(signals)
  return { fingerprint, ...signals }
}

export function CheckInPanel({
  state,
  selfieRequired = false,
  userId,
  shifts = [],
  defaultShiftId = null,
  roundsUsed = 0,
}: {
  state: State
  selfieRequired?: boolean
  userId: string
  shifts?: ShiftOption[]
  defaultShiftId?: string | null
  roundsUsed?: number
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult | null>(null)
  const [workPlan, setWorkPlan] = useState('')
  const [summary, setSummary] = useState('')
  const [completed, setCompleted] = useState('')
  const [issues, setIssues] = useState('')
  const [busy, setBusy] = useState(false)
  const [selfiePath, setSelfiePath] = useState<string | null>(null)
  // กะที่เลือกวันนี้ — default = กะประจำตัว ไม่งั้นกะแรก
  const [shiftId, setShiftId] = useState<string>(
    defaultShiftId && shifts.some((s) => s.id === defaultShiftId)
      ? defaultShiftId
      : shifts[0]?.id ?? ''
  )

  // เลือก "กะของวันไหน" — ช่วงค่ำ (>=18:00) เข้าก่อนเวลาให้เลือกกะของพรุ่งนี้ได้
  // (กันเคสกะเที่ยงคืนของวันที่ 20 เข้ามา 23:45 แล้วโดนนับสายของวันที่ 19)
  const [dayChoice, setDayChoice] = useState<'today' | 'tomorrow'>('today')
  const [isEvening, setIsEvening] = useState(false)
  const [dates, setDates] = useState<{ today: string; tomorrow: string }>({ today: '', tomorrow: '' })
  useEffect(() => {
    const now = new Date()
    const evening = now.getHours() >= 18
    setIsEvening(evening)
    const fmt = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    const tmr = new Date(now.getTime() + 86_400_000)
    setDates({ today: fmt(now), tomorrow: fmt(tmr) })
    // default ฉลาด: ช่วงค่ำ + กะที่เลือกเริ่มช่วง 00:00–05:59 → น่าจะเป็นกะของพรุ่งนี้
    if (evening) {
      const sel = shifts.find((s) => s.id === (defaultShiftId ?? shifts[0]?.id))
      const startHour = sel ? Number(sel.start_time.slice(0, 2)) : NaN
      if (!Number.isNaN(startHour) && startHour < 6) setDayChoice('tomorrow')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCheckIn() {
    if (selfieRequired && !selfiePath) {
      setResult({ ok: false, error: 'กรุณาถ่ายรูปยืนยันตัวตนก่อน' })
      return
    }
    if (shifts.length > 0 && !shiftId) {
      setResult({ ok: false, error: 'กรุณาเลือกกะที่ทำงานวันนี้' })
      return
    }
    setBusy(true)
    setResult(null)
    const [pos, device] = await Promise.all([getPosition(), buildDevice()])
    startTransition(async () => {
      const res = await checkInAction({
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
        locationDenied: pos.denied,
        device,
        workPlan,
        selfiePath: selfiePath ?? undefined,
        shiftId: shiftId || null,
        workDateChoice: dayChoice,
      })
      setResult(res)
      setBusy(false)
    })
  }

  async function handleCheckOut() {
    setBusy(true)
    setResult(null)
    const [pos, device] = await Promise.all([getPosition(), buildDevice()])
    startTransition(async () => {
      const res = await checkOutAction({
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
        device,
        workSummary: summary,
        completedWork: completed,
        issuesFaced: issues,
      })
      setResult(res)
      setBusy(false)
    })
  }

  const loading = busy || isPending

  return (
    <div className="space-y-4">
      {result && (
        <div
          className={`rounded-lg p-3 text-sm ${
            result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {result.ok ? result.message : result.error}
        </div>
      )}

      {state === 'not_checked_in' && (
        <>
          {roundsUsed > 0 && (
            <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              คุณเช็คเอาต์รอบก่อนหน้าแล้ว — เช็คอินอีกครั้ง<b>เมื่อพร้อมเริ่มรอบถัดไป</b>เท่านั้น
              (ไม่ใช่การสุ่มยืนยันตัวตน ไม่บังคับ)
            </div>
          )}
          {selfieRequired && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">ถ่ายรูปยืนยันตัวตน (บังคับ)</p>
              <SelfieCapture userId={userId} purpose="checkin" onCaptured={setSelfiePath} />
            </div>
          )}
          {isEvening && (
            <div>
              <label className="block text-sm font-medium">เข้ากะของวันไหน</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDayChoice('today')}
                  className={`rounded-lg border p-3 text-sm transition ${
                    dayChoice === 'today'
                      ? 'border-brand-600 bg-brand-50 font-medium text-brand-700 dark:bg-brand-600/15 dark:text-brand-500'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  วันนี้ ({dates.today})
                </button>
                <button
                  type="button"
                  onClick={() => setDayChoice('tomorrow')}
                  className={`rounded-lg border p-3 text-sm transition ${
                    dayChoice === 'tomorrow'
                      ? 'border-brand-600 bg-brand-50 font-medium text-brand-700 dark:bg-brand-600/15 dark:text-brand-500'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  พรุ่งนี้ ({dates.tomorrow})
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                เข้ากะเที่ยงคืน/เช้ามืดของวันพรุ่งนี้ก่อนเวลา ให้เลือก &quot;พรุ่งนี้&quot; — ระบบจะคิดเวลาสายจากกะของวันนั้น
              </p>
            </div>
          )}
          {shifts.length > 0 && (
            <div>
              <label className="block text-sm font-medium">กะที่ทำงานวันนี้</label>
              <select
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
                className="mt-1 w-full rounded-lg border p-3 text-sm"
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({hhmm(s.start_time)}–{hhmm(s.end_time)})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">เลือกกะที่ตรงกับเวลาทำงานวันนี้ (ระบบคิดสายจากกะนี้)</p>
            </div>
          )}
          <label className="block text-sm font-medium">แผนงานวันนี้</label>
          <textarea
            value={workPlan}
            onChange={(e) => setWorkPlan(e.target.value)}
            rows={3}
            placeholder="วันนี้ตั้งใจทำงานอะไรบ้าง"
            className="w-full rounded-lg border p-3 text-sm"
          />
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 dark:bg-brand-600 py-4 text-base font-semibold text-white disabled:opacity-60"
          >
            {loading
              ? 'กำลังเช็คอิน…'
              : roundsUsed > 0
                ? `🟢 เช็คอินรอบใหม่ (รอบที่ ${roundsUsed + 1})`
                : '🟢 เช็คอินเข้างาน'}
          </button>
          <p className="text-center text-xs text-slate-400">
            ระบบจะขอตำแหน่งและข้อมูลอุปกรณ์เฉพาะตอนเช็คอินเท่านั้น
          </p>
        </>
      )}

      {state === 'working' && (
        <>
          <label className="block text-sm font-medium">สรุปงานวันนี้</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            placeholder="ภาพรวมงานที่ทำ"
            className="w-full rounded-lg border p-3 text-sm"
          />
          <label className="block text-sm font-medium">งานที่ทำสำเร็จ</label>
          <textarea
            value={completed}
            onChange={(e) => setCompleted(e.target.value)}
            rows={2}
            className="w-full rounded-lg border p-3 text-sm"
          />
          <label className="block text-sm font-medium">ปัญหาที่เจอ</label>
          <textarea
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
            rows={2}
            className="w-full rounded-lg border p-3 text-sm"
          />
          <button
            onClick={handleCheckOut}
            disabled={loading}
            className="w-full rounded-xl bg-red-600 py-4 text-base font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'กำลังเช็คเอาต์…' : '🔴 เช็คเอาต์ออกงาน'}
          </button>
        </>
      )}

      {state === 'checked_out' && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
          คุณเช็คเอาต์เรียบร้อยแล้ววันนี้ ขอบคุณสำหรับการทำงาน 🎉
        </div>
      )}
    </div>
  )
}
