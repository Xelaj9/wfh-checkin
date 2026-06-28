'use client'

import { useState, useTransition } from 'react'
import { upsertWorkLocationAction } from '@/actions/manage'

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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // ช่วยกรอกพิกัดปัจจุบันจาก browser (สะดวกตอนตั้งค่าหน้างาน)
  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition((p) => {
      setLat(String(p.coords.latitude))
      setLng(String(p.coords.longitude))
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
      } else setMsg({ ok: false, text: res.error })
    })
  }

  return (
    <div className="rounded-xl border bg-white p-5">
      <h2 className="mb-3 font-semibold">กำหนดพื้นที่ทำงาน (Geofence)</h2>
      {msg && (
        <p className={`mb-2 rounded-lg p-2 text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </p>
      )}
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
        <button type="button" onClick={useMyLocation} className="rounded-lg border px-3 py-1.5 text-sm text-slate-600">
          ใช้ตำแหน่งปัจจุบัน
        </button>
      </div>
      <button
        onClick={submit}
        disabled={isPending || !userId || !label || !lat || !lng}
        className="mt-3 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? 'กำลังบันทึก…' : 'บันทึกพื้นที่'}
      </button>
    </div>
  )
}
