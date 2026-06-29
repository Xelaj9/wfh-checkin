'use client'

import { useState, useTransition } from 'react'
import { createShiftAction, updateShiftAction, deleteShiftAction } from '@/actions/shifts'
import type { Shift } from '@/lib/database.types'

const hhmm = (t: string) => t?.slice(0, 5) ?? ''

export function ShiftsManager({ shifts }: { shifts: Shift[] }) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // ฟอร์มกะใหม่
  const [name, setName] = useState('')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('18:00')
  const [grace, setGrace] = useState('15')

  const atMax = shifts.length >= 6

  function add() {
    setMsg(null)
    startTransition(async () => {
      const res = await createShiftAction({
        name,
        startTime: start,
        endTime: end,
        lateGraceMinutes: Number(grace),
      })
      if (res.ok) setName('')
      else setMsg({ ok: false, text: res.error })
    })
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-semibold">กะการทำงาน ({shifts.length}/6)</h2>
      </div>
      <p className="mb-3 text-sm text-muted">ตั้งได้ 1–6 กะ · ระบบคิด “มาสาย” จากเวลาเข้าของกะที่พนักงานสังกัด</p>

      {msg && (
        <p className={`mb-3 rounded-lg p-2 text-sm ${msg.ok ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'}`}>
          {msg.text}
        </p>
      )}

      <div className="space-y-2">
        {shifts.map((s) => (
          <ShiftRow key={s.id} shift={s} disabled={isPending} />
        ))}
        {shifts.length === 0 && <p className="text-sm text-muted">ยังไม่มีกะ — เพิ่มกะแรกด้านล่าง</p>}
      </div>

      {/* เพิ่มกะใหม่ */}
      {!atMax && (
        <div className="mt-4 border-t border-slate-200/70 pt-4 dark:border-slate-800">
          <p className="mb-2 text-sm font-medium">เพิ่มกะใหม่</p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="ชื่อกะ">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น กะเช้า" className="w-32" />
            </Field>
            <Field label="เข้า">
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="เลิก">
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
            <Field label="ผ่อนผัน(นาที)">
              <input type="number" value={grace} onChange={(e) => setGrace(e.target.value)} className="w-20" />
            </Field>
            <button onClick={add} disabled={isPending || !name} className="btn-primary py-2">
              เพิ่มกะ
            </button>
          </div>
        </div>
      )}
      {atMax && <p className="mt-3 text-xs text-muted">ครบ 6 กะแล้ว (ลบกะเดิมก่อนถ้าต้องการเพิ่ม)</p>}
    </div>
  )
}

function ShiftRow({ shift, disabled }: { shift: Shift; disabled: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(shift.name)
  const [start, setStart] = useState(hhmm(shift.start_time))
  const [end, setEnd] = useState(hhmm(shift.end_time))
  const [grace, setGrace] = useState(String(shift.late_grace_minutes))
  const busy = disabled || isPending

  function save() {
    startTransition(async () => {
      await updateShiftAction({ id: shift.id, name, startTime: start, endTime: end, lateGraceMinutes: Number(grace) })
    })
  }
  function remove() {
    if (!confirm(`ลบกะ "${shift.name}"? พนักงานในกะนี้จะถูกปลดออกจากกะ`)) return
    startTransition(async () => {
      await deleteShiftAction({ id: shift.id })
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200/70 p-2 dark:border-slate-800">
      <Field label="ชื่อกะ">
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-32" />
      </Field>
      <Field label="เข้า">
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="เลิก">
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <Field label="ผ่อนผัน(นาที)">
        <input type="number" value={grace} onChange={(e) => setGrace(e.target.value)} className="w-20" />
      </Field>
      <button onClick={save} disabled={busy} className="btn-primary py-2">บันทึก</button>
      <button onClick={remove} disabled={busy} className="rounded-xl border border-red-300 px-3 py-2 text-sm text-red-600 dark:border-red-500/40">
        ลบ
      </button>
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
