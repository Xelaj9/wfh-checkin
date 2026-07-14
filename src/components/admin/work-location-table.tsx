'use client'

import { useState, useTransition } from 'react'
import { updateWorkLocationAction, deleteWorkLocationAction } from '@/actions/manage'

export interface LocationRow {
  id: string
  label: string
  latitude: number
  longitude: number
  radius_meters: number
  ownerName: string
}

/** ตารางพื้นที่ที่ตั้งไว้แล้ว — แก้ไข inline + ลบได้ */
export function WorkLocationTable({ locations }: { locations: LocationRow[] }) {
  return (
    <div className="rounded-xl border bg-white dark:bg-slate-900 p-5">
      <h2 className="mb-3 font-semibold">พื้นที่ที่ตั้งไว้แล้ว</h2>
      {locations.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">ยังไม่ได้ตั้งพื้นที่</p>
      ) : (
        <div className="space-y-2">
          {locations.map((l) => (
            <Row key={l.id} loc={l} />
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ loc }: { loc: LocationRow }) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(loc.label)
  const [lat, setLat] = useState(String(loc.latitude))
  const [lng, setLng] = useState(String(loc.longitude))
  const [radius, setRadius] = useState(String(loc.radius_meters))
  const [err, setErr] = useState<string | null>(null)

  function save() {
    setErr(null)
    startTransition(async () => {
      const res = await updateWorkLocationAction({
        id: loc.id,
        label,
        latitude: Number(lat),
        longitude: Number(lng),
        radiusMeters: Number(radius),
      })
      if (res.ok) setEditing(false)
      else setErr(res.error)
    })
  }

  function remove() {
    if (!confirm(`ลบพื้นที่ "${loc.label}" ของ ${loc.ownerName}?`)) return
    startTransition(async () => {
      const res = await deleteWorkLocationAction({ id: loc.id })
      if (!res.ok) setErr(res.error)
    })
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/70 px-3 py-2 text-sm dark:border-slate-800">
        <div className="min-w-0">
          <span className="font-medium">{loc.ownerName}</span>
          <span className="mx-2 text-muted">·</span>
          <span>{loc.label}</span>
          <span className="mx-2 text-muted">·</span>
          <span className="text-muted">{loc.radius_meters} ม.</span>
        </div>
        <div className="flex items-center gap-3">
          {err && <span className="text-xs text-red-600">{err}</span>}
          <a
            href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted underline hover:text-brand-600"
          >
            ดูแผนที่
          </a>
          <button onClick={() => setEditing(true)} disabled={isPending} className="text-xs text-brand-600 hover:underline">
            แก้ไข
          </button>
          <button onClick={remove} disabled={isPending} className="text-xs text-red-600 hover:underline">
            {isPending ? 'กำลังลบ…' : 'ลบ'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-brand-500/50 p-3">
      <p className="mb-2 text-sm font-medium">{loc.ownerName}</p>
      {err && <p className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{err}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="ชื่อพื้นที่">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-36" />
        </Field>
        <Field label="latitude">
          <input value={lat} onChange={(e) => setLat(e.target.value)} className="w-32" />
        </Field>
        <Field label="longitude">
          <input value={lng} onChange={(e) => setLng(e.target.value)} className="w-32" />
        </Field>
        <Field label="รัศมี (ม.)">
          <input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} className="w-24" />
        </Field>
        <button onClick={save} disabled={isPending || !label} className="btn-primary py-2">
          {isPending ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
        <button onClick={() => setEditing(false)} disabled={isPending} className="btn-ghost py-2">
          ยกเลิก
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  )
}
