'use client'

import { useEffect, useState, useTransition } from 'react'
import { acknowledgePresenceAction } from '@/actions/presence'
import { SelfieCapture } from '@/components/employee/selfie-capture'

interface Pending {
  id: string
  respondBy: string
}

function getPosition(): Promise<{ lat: number | null; lng: number | null; accuracy: number | null }> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve({ lat: null, lng: null, accuracy: null })
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve({ lat: null, lng: null, accuracy: null }),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

/** แบนเนอร์ยืนยันตัวตนเมื่อถูกสุ่ม — แสดงนับถอยหลัง + ปุ่มยืนยัน */
export function PresenceCheckBanner({
  pending,
  userId,
  selfieRequired = false,
}: {
  pending: Pending
  userId: string
  selfieRequired?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selfiePath, setSelfiePath] = useState<string | null>(null)
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    const tick = () => {
      const ms = new Date(pending.respondBy).getTime() - Date.now()
      if (ms <= 0) {
        setRemaining('หมดเวลา')
        return
      }
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setRemaining(`${m}:${s.toString().padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [pending.respondBy])

  function acknowledge() {
    if (selfieRequired && !selfiePath) {
      setError('กรุณาถ่ายรูปยืนยันก่อน')
      return
    }
    setError(null)
    startTransition(async () => {
      const pos = await getPosition()
      const res = await acknowledgePresenceAction({
        presenceId: pending.id,
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy,
        selfiePath: selfiePath ?? undefined,
      })
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-amber-900">⏰ กรุณายืนยันตัวตน</p>
        <span className="font-mono text-sm text-amber-700">{remaining}</span>
      </div>
      <p className="mt-1 text-sm text-amber-700">ระบบสุ่มให้ยืนยันว่าคุณยังทำงานอยู่</p>

      {selfieRequired && (
        <div className="mt-3">
          <SelfieCapture userId={userId} purpose="presence" onCaptured={setSelfiePath} />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <button
        onClick={acknowledge}
        disabled={isPending}
        className="mt-3 w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? 'กำลังยืนยัน…' : 'ยืนยันตัวตนตอนนี้'}
      </button>
    </div>
  )
}
