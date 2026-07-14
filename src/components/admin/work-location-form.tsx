'use client'

import { useState, useTransition } from 'react'
import { upsertWorkLocationAction } from '@/actions/manage'
import { resolveLocationLinkAction } from '@/actions/geo'

interface Employee {
  id: string
  full_name: string | null
  email: string
}

/** แอดมินกำหนดพื้นที่ทำงานที่อนุญาตให้พนักงาน */
export function WorkLocationForm({
  employees,
  defaultRadius,
}: {
  employees: Employee[]
  defaultRadius: number
}) {
  const [isPending, startTransition] = useTransition()
  const [userId, setUserId] = useState('')
  const [label, setLabel] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radius, setRadius] = useState(String(defaultRadius))
  const [link, setLink] = useState('')
  const [resolving, setResolving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // ช่วยกรอกพิกัดปัจจุบันจาก browser (สะดวกตอนตั้งค่าหน้างาน)
  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition((p) => {
      setLat(String(p.coords.latitude))
      setLng(String(p.coords.longitude))
    })
  }

  // ดึงพิกัดจากลิงก์ Google Maps ที่พนักงานส่งมา
  function resolveLink() {
    if (!link.trim()) return
    setResolving(true)
    setMsg(null)
    startTransition(async () => {
      const res = await resolveLocationLinkAction({ link })
      if (res.ok) {
        setLat(String(res.lat))
        setLng(String(res.lng))
        setMsg({ ok: true, text: `ดึงพิกัดสำเร็จ: ${res.lat}, ${res.lng}` })
      } else {
        setMsg({ ok: false, text: res.error })
      }
      setResolving(false)
    })
  }

  function submit() {
    setMsg(null)
    startTransition(async () => {
      const res = await upsertWorkLocationAction({
        userId,
        label,
        latitude: Number(lat),
        longitude: Number(lng),
        radiusMeters: Number(radius),
      })
      if (res.ok) {
        setMsg({ ok: true, text: 'บันทึกพื้นที่แล้ว' })
        setLabel('')
        setLat('')
        setLng('')
        setLink('')
      } else setMsg({ ok: false, text: res.error })
    })
  }

  return (
    <div className="rounded-xl border bg-white dark:bg-slate-900 p-5">
      <h2 className="mb-3 font-semibold">กำหนดพื้นที่ทำงาน (Geofence)</h2>
      <p className="mb-3 -mt-2 text-xs text-muted">รายชื่อจะขึ้นหลังพนักงาน login ด้วย Google ครั้งแรก (คนใน whitelist ที่ &quot;ยังไม่เคยเข้า&quot; จะยังไม่ปรากฏ)</p>
      {msg && (
        <p
          className={`mb-3 rounded-lg p-2 text-sm ${
            msg.ok
              ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* วางลิงก์ตำแหน่งจากพนักงาน → ดึงพิกัดอัตโนมัติ */}
      <div className="mb-3 rounded-lg surface-muted p-3">
        <label className="mb-1 block text-sm font-medium">วางลิงก์ตำแหน่ง (Google Maps)</label>
        <div className="flex gap-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="เช่น https://maps.app.goo.gl/… หรือ 13.72, 100.53"
            className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), resolveLink())}
          />
          <button
            type="button"
            onClick={resolveLink}
            disabled={resolving || !link.trim()}
            className="btn-primary whitespace-nowrap py-1.5"
          >
            {resolving ? 'กำลังดึง…' : 'ดึงพิกัด'}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          ให้พนักงานกดแชร์ตำแหน่งใน Google Maps แล้วส่งลิงก์มา — วางที่นี่ ระบบเติม lat/lng ให้เอง
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="rounded-lg border px-3 py-1.5 text-sm">
          <option value="">— เลือกพนักงาน —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name ?? e.email}
            </option>
          ))}
        </select>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ชื่อพื้นที่ เช่น บ้าน" className="rounded-lg border px-3 py-1.5 text-sm" />
        <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="latitude" className="rounded-lg border px-3 py-1.5 text-sm" />
        <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="longitude" className="rounded-lg border px-3 py-1.5 text-sm" />
        <input value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="รัศมี (เมตร)" type="number" className="rounded-lg border px-3 py-1.5 text-sm" />
        <button type="button" onClick={useMyLocation} className="rounded-lg border px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
          ใช้ตำแหน่งปัจจุบัน
        </button>
      </div>
      <button
        onClick={submit}
        disabled={isPending || !userId || !label || !lat || !lng}
        className="mt-3 rounded-lg bg-slate-900 dark:bg-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? 'กำลังบันทึก…' : 'บันทึกพื้นที่'}
      </button>
    </div>
  )
}
