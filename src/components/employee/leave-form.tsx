'use client'

import { useState, useTransition } from 'react'
import { requestLeaveAction, cancelLeaveAction } from '@/actions/leave'

interface LeaveRow {
  id: string
  leave_date: string
  reason: string | null
  status: string
  admin_note: string | null
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: 'รออนุมัติ', cls: 'badge-pending' },
  approved: { label: 'อนุมัติแล้ว', cls: 'badge-normal' },
  rejected: { label: 'ถูกปฏิเสธ', cls: 'badge-suspicious' },
}

export function LeaveForm({
  requests,
  minAdvanceDays,
  usedThisMonth,
  maxPerMonth,
}: {
  requests: LeaveRow[]
  minAdvanceDays: number
  usedThisMonth: number
  maxPerMonth: number
}) {
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // วันแรกที่ยื่นได้ = วันนี้ + minAdvanceDays
  const minDate = new Date(Date.now() + minAdvanceDays * 86_400_000).toISOString().slice(0, 10)

  function submit() {
    setMsg(null)
    startTransition(async () => {
      const res = await requestLeaveAction({ leaveDate: date, reason: reason || undefined })
      if (res.ok) {
        setMsg({ ok: true, text: 'ส่งคำขอลาแล้ว — รอแอดมินอนุมัติ' })
        setDate('')
        setReason('')
      } else setMsg({ ok: false, text: res.error })
    })
  }

  function cancel(id: string) {
    if (!confirm('ยกเลิกคำขอลานี้?')) return
    startTransition(async () => {
      const res = await cancelLeaveAction({ id })
      if (!res.ok) setMsg({ ok: false, text: res.error })
    })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-2xl border bg-white dark:bg-slate-900 p-4">
        <h3 className="font-semibold">ยื่นขอวันลา</h3>
        <p className="text-xs text-slate-400">
          ยื่นล่วงหน้าอย่างน้อย {minAdvanceDays} วัน · เดือนนี้ใช้ไป {usedThisMonth}/{maxPerMonth} ครั้ง
          · ลาสำเร็จเมื่อแอดมินอนุมัติเท่านั้น
        </p>

        {msg && (
          <p
            className={`rounded-lg p-2 text-sm ${
              msg.ok
                ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300'
                : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
            }`}
          >
            {msg.text}
          </p>
        )}

        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">วันที่ต้องการลา</span>
          <input
            type="date"
            value={date}
            min={minDate}
            onChange={(e) => setDate(e.target.value)}
            className="w-full"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">เหตุผล (ถ้ามี)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="เช่น ลากิจ ไปติดต่อราชการ"
            className="w-full"
          />
        </label>
        <button
          onClick={submit}
          disabled={isPending || !date}
          className="w-full rounded-xl bg-slate-900 dark:bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? 'กำลังส่ง…' : 'ส่งคำขอลา'}
        </button>
      </div>

      <section className="space-y-2">
        <h3 className="font-semibold">คำขอลาของฉัน</h3>
        {requests.length === 0 && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">
            ยังไม่มีคำขอลา
          </p>
        )}
        {requests.map((r) => {
          const st = STATUS_LABEL[r.status] ?? { label: r.status, cls: 'badge-pending' }
          return (
            <div key={r.id} className="rounded-xl border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.leave_date}</span>
                <span className={`badge ${st.cls}`}>{st.label}</span>
              </div>
              {r.reason && <p className="mt-1 text-slate-500">{r.reason}</p>}
              {r.admin_note && (
                <p className="mt-1 text-xs text-slate-400">หมายเหตุแอดมิน: {r.admin_note}</p>
              )}
              {r.status === 'pending' && (
                <button
                  onClick={() => cancel(r.id)}
                  disabled={isPending}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  ยกเลิกคำขอ
                </button>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
