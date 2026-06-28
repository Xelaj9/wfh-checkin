'use client'

import { useState, useTransition } from 'react'
import { decideAdjustmentAction } from '@/actions/adjustments'

export function AdjustmentDecision({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const [done, setDone] = useState<string | null>(null)

  function decide(decision: 'approved' | 'rejected') {
    startTransition(async () => {
      const res = await decideAdjustmentAction({ id, decision, adminNote: note || undefined })
      if (res.ok) setDone(decision === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว')
    })
  }

  if (done) return <span className="text-sm font-medium text-slate-500">{done}</span>

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="หมายเหตุ (ถ้ามี)"
        className="rounded-lg border px-3 py-1.5 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={() => decide('approved')}
          disabled={isPending}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          อนุมัติ
        </button>
        <button
          onClick={() => decide('rejected')}
          disabled={isPending}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-60"
        >
          ปฏิเสธ
        </button>
      </div>
    </div>
  )
}
