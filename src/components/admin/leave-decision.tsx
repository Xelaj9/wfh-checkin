'use client'

import { useState, useTransition } from 'react'
import { decideLeaveAction } from '@/actions/leave'

export function LeaveDecision({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  function decide(decision: 'approved' | 'rejected') {
    setErr(null)
    startTransition(async () => {
      const res = await decideLeaveAction({ id, decision, adminNote: note || undefined })
      if (res.ok) setDone(decision === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว')
      else setErr(res.error)
    })
  }

  if (done) return <span className="text-sm font-medium text-slate-500">{done}</span>

  return (
    <div className="space-y-2">
      {err && <p className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{err}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="หมายเหตุ (ถ้ามี)"
          className="px-3 py-1.5 text-sm"
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
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-60 dark:border-red-500/40"
          >
            ปฏิเสธ
          </button>
        </div>
      </div>
    </div>
  )
}
