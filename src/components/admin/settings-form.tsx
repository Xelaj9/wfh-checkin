'use client'

import { useState, useTransition } from 'react'
import { updateSettingsAction } from '@/actions/settings'
import type { AppSettings } from '@/lib/settings'

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const [isPending, startTransition] = useTransition()
  const [s, setS] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await updateSettingsAction(s)
      setMsg(res.ok ? { ok: true, text: 'บันทึกแล้ว' } : { ok: false, text: res.error })
    })
  }

  return (
    <div className="space-y-4 rounded-xl border bg-white p-5">
      {msg && (
        <p className={`rounded-lg p-2 text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </p>
      )}

      <Toggle
        label="บังคับถ่าย selfie ตอนเช็คอิน"
        checked={s.selfie_required}
        onChange={(v) => setS({ ...s, selfie_required: v })}
      />
      <Toggle
        label="ปิดตำแหน่ง = เช็คอินไม่ได้ (ปิด = เช็คอินได้แต่ pending)"
        checked={s.block_checkin_without_location}
        onChange={(v) => setS({ ...s, block_checkin_without_location: v })}
      />
      <NumberField
        label="จำนวน presence check ต่อวัน (0–6)"
        value={s.presence_checks_per_day}
        min={0}
        max={6}
        onChange={(v) => setS({ ...s, presence_checks_per_day: v })}
      />
      <NumberField
        label="เวลาให้ตอบ presence check (นาที, 3–60)"
        value={s.presence_response_minutes}
        min={3}
        max={60}
        onChange={(v) => setS({ ...s, presence_response_minutes: v })}
      />
      <NumberField
        label="รัศมี geofence เริ่มต้น (เมตร, 50–2000)"
        value={s.default_geofence_radius}
        min={50}
        max={2000}
        onChange={(v) => setS({ ...s, default_geofence_radius: v })}
      />
      <NumberField
        label="ระยะเวลาเก็บข้อมูล (วัน, 30–3650)"
        value={s.data_retention_days}
        min={30}
        max={3650}
        onChange={(v) => setS({ ...s, data_retention_days: v })}
      />

      <button
        onClick={save}
        disabled={isPending}
        className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}
      </button>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />
    </label>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-700">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-lg border px-3 py-1.5 text-sm"
      />
    </label>
  )
}
