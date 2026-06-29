'use client'

import { useState, useTransition } from 'react'
import { updateTeamAction } from '@/actions/teams'

interface TeamShift {
  id: string
  name: string
  work_start: string
  work_end: string
  late_grace_minutes: number
}

/** ตั้งค่ากะของแต่ละทีม: เวลาเข้า–เลิก + ผ่อนผันสาย */
export function TeamShiftForm({ teams }: { teams: TeamShift[] }) {
  return (
    <div className="card p-5">
      <h2 className="mb-1 font-semibold">เวลาทำงาน (กะ) ของแต่ละทีม</h2>
      <p className="mb-4 text-sm text-muted">เวลาเข้า–เลิกงาน + ระยะผ่อนผันก่อนนับว่า “มาสาย”</p>
      <div className="space-y-4">
        {teams.map((t) => (
          <TeamRow key={t.id} team={t} />
        ))}
        {teams.length === 0 && <p className="text-sm text-muted">ยังไม่มีทีม</p>}
      </div>
    </div>
  )
}

function TeamRow({ team }: { team: TeamShift }) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(team.name)
  const [start, setStart] = useState(team.work_start.slice(0, 5))
  const [end, setEnd] = useState(team.work_end.slice(0, 5))
  const [grace, setGrace] = useState(team.late_grace_minutes)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await updateTeamAction({
        teamId: team.id,
        name,
        workStart: start,
        workEnd: end,
        lateGraceMinutes: Number(grace),
      })
      setMsg(res.ok ? { ok: true, text: 'บันทึกแล้ว' } : { ok: false, text: res.error })
    })
  }

  return (
    <div className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-800">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted">ชื่อทีม</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-40" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">เข้างาน</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-28" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">เลิกงาน</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-28" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">ผ่อนผัน (นาที)</span>
          <input type="number" min={0} max={120} value={grace} onChange={(e) => setGrace(Number(e.target.value))} className="w-24" />
        </label>
        <button onClick={save} disabled={isPending} className="btn-primary">
          {isPending ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</span>
        )}
      </div>
    </div>
  )
}
