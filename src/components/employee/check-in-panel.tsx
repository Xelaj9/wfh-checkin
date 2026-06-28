'use client'

import { useState, useTransition } from 'react'
import { checkInAction, checkOutAction, type ActionResult } from '@/actions/attendance'
import { collectDeviceSignals, computeFingerprint } from '@/lib/device-fingerprint'
import { SelfieCapture } from '@/components/employee/selfie-capture'

type State = 'not_checked_in' | 'working' | 'checked_out'

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
}: {
  state: State
  selfieRequired?: boolean
  userId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult | null>(null)
  const [workPlan, setWorkPlan] = useState('')
  const [summary, setSummary] = useState('')
  const [completed, setCompleted] = useState('')
  const [issues, setIssues] = useState('')
  const [busy, setBusy] = useState(false)
  const [selfiePath, setSelfiePath] = useState<string | null>(null)

  async function handleCheckIn() {
    if (selfieRequired && !selfiePath) {
      setResult({ ok: false, error: 'กรุณาถ่ายรูปยืนยันตัวตนก่อน' })
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
          {selfieRequired && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">ถ่ายรูปยืนยันตัวตน (บังคับ)</p>
              <SelfieCapture userId={userId} purpose="checkin" onCaptured={setSelfiePath} />
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
            className="w-full rounded-xl bg-slate-900 py-4 text-base font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'กำลังเช็คอิน…' : '🟢 เช็คอินเข้างาน'}
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
