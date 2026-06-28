'use client'

import { useState, useTransition } from 'react'
import { addWorkLogAction, setWorkLogStatusAction } from '@/actions/worklog'
import type { WorkLog, WorkLogStatus } from '@/lib/database.types'

const STATUS_LABEL: Record<WorkLogStatus, { label: string; cls: string }> = {
  planned: { label: 'วางแผน', cls: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'กำลังทำ', cls: 'bg-blue-100 text-blue-700' },
  done: { label: 'เสร็จ', cls: 'bg-green-100 text-green-700' },
  blocked: { label: 'ติดปัญหา', cls: 'bg-red-100 text-red-700' },
}
const NEXT: Record<WorkLogStatus, WorkLogStatus> = {
  planned: 'in_progress',
  in_progress: 'done',
  done: 'planned',
  blocked: 'in_progress',
}

export function WorkLogSection({ logs }: { logs: WorkLog[] }) {
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')

  function add() {
    if (!title.trim()) return
    startTransition(async () => {
      await addWorkLogAction({ title, status: 'planned' })
      setTitle('')
    })
  }

  function cycle(log: WorkLog) {
    startTransition(async () => {
      await setWorkLogStatusAction({ id: log.id, status: NEXT[log.status] })
    })
  }

  return (
    <section className="rounded-2xl border bg-white p-4">
      <h3 className="mb-2 font-semibold">บันทึกงานระหว่างวัน</h3>
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="เพิ่มงานที่ทำ…"
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button
          onClick={add}
          disabled={isPending}
          className="rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          เพิ่ม
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {logs.length === 0 && <li className="text-sm text-slate-400">ยังไม่มีบันทึกงานวันนี้</li>}
        {logs.map((log) => {
          const s = STATUS_LABEL[log.status]
          return (
            <li key={log.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
              <span>{log.title}</span>
              <button
                onClick={() => cycle(log)}
                disabled={isPending}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}
                title="แตะเพื่อเปลี่ยนสถานะ"
              >
                {s.label}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
