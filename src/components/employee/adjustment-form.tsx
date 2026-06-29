'use client'

import { useState, useTransition } from 'react'
import { createAdjustmentAction } from '@/actions/adjustments'
import { createClient } from '@/lib/supabase/client'

export function AdjustmentForm({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [date, setDate] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState<File | null>(null)

  function submit() {
    setMsg(null)
    startTransition(async () => {
      let evidencePath: string | undefined
      if (file) {
        const path = `${userId}/adjustment/${Date.now()}-${file.name}`
        const supabase = createClient()
        const { error } = await supabase.storage.from('evidence').upload(path, file)
        if (error) {
          setMsg({ ok: false, text: 'อัปโหลดหลักฐานไม่สำเร็จ' })
          return
        }
        evidencePath = path
      }

      const res = await createAdjustmentAction({
        targetDate: date,
        requestedCheckIn: checkIn ? new Date(checkIn).toISOString() : undefined,
        requestedCheckOut: checkOut ? new Date(checkOut).toISOString() : undefined,
        reason,
        evidencePath,
      })
      if (res.ok) {
        setMsg({ ok: true, text: 'ส่งคำขอเรียบร้อย รอแอดมินอนุมัติ' })
        setDate('')
        setCheckIn('')
        setCheckOut('')
        setReason('')
        setFile(null)
      } else {
        setMsg({ ok: false, text: res.error })
      }
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-white dark:bg-slate-900 p-4">
      <h3 className="font-semibold">ขอแก้ไขเวลา</h3>
      {msg && (
        <p className={`rounded-lg p-2 text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </p>
      )}
      <label className="block text-sm">
        <span className="mb-1 block text-slate-500">วันที่ต้องการแก้</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">เวลาเข้า</span>
          <input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full rounded-lg border px-2 py-2" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">เวลาออก</span>
          <input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full rounded-lg border px-2 py-2" />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-500">เหตุผล</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="เช่น ลืมเช็คอิน / เน็ตเสีย" className="w-full rounded-lg border p-3" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-500">แนบหลักฐาน (ถ้ามี)</span>
        <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
      </label>
      <button
        onClick={submit}
        disabled={isPending || !date || reason.length < 5}
        className="w-full rounded-lg bg-slate-900 dark:bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? 'กำลังส่ง…' : 'ส่งคำขอ'}
      </button>
    </div>
  )
}
