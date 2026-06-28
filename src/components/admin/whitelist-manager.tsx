'use client'

import { useState, useTransition } from 'react'
import { addAllowedEmailAction, removeAllowedEmailAction } from '@/actions/manage'

interface Entry {
  id: string
  email: string
  role: string
  full_name: string | null
  used_at: string | null
}
interface Team {
  id: string
  name: string
}

export function WhitelistManager({
  entries,
  teams,
  isSuperAdmin,
  defaultTeamId,
}: {
  entries: Entry[]
  teams: Team[]
  isSuperAdmin: boolean
  defaultTeamId: string | null
}) {
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'employee' | 'admin' | 'super_admin'>('employee')
  const [teamId, setTeamId] = useState(defaultTeamId ?? '')
  const [msg, setMsg] = useState<string | null>(null)

  function add() {
    setMsg(null)
    startTransition(async () => {
      const res = await addAllowedEmailAction({
        email,
        role,
        fullName: fullName || undefined,
        teamId: teamId || null,
      })
      if (res.ok) {
        setEmail('')
        setFullName('')
      } else setMsg(res.error)
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeAllowedEmailAction({ id })
    })
  }

  return (
    <div className="rounded-xl border bg-white p-5">
      <h2 className="mb-3 font-semibold">รายชื่ออีเมลที่อนุญาต (Whitelist)</h2>

      {msg && <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{msg}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@company.com"
          className="rounded-lg border px-3 py-1.5 text-sm"
        />
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="ชื่อ-สกุล"
          className="rounded-lg border px-3 py-1.5 text-sm"
        />
        {isSuperAdmin && (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            <option value="employee">พนักงาน</option>
            <option value="admin">ผู้จัดการ</option>
            <option value="super_admin">Super Admin</option>
          </select>
        )}
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm"
        >
          <option value="">— เลือกทีม —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          onClick={add}
          disabled={isPending || !email}
          className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          เพิ่ม
        </button>
      </div>

      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="py-1">อีเมล</th>
            <th className="py-1">บทบาท</th>
            <th className="py-1">สถานะ</th>
            <th className="py-1"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="py-1.5">{e.email}</td>
              <td className="py-1.5">{e.role}</td>
              <td className="py-1.5 text-slate-400">
                {e.used_at ? 'เคยเข้าใช้แล้ว' : 'ยังไม่เคยเข้า'}
              </td>
              <td className="py-1.5 text-right">
                <button
                  onClick={() => remove(e.id)}
                  disabled={isPending}
                  className="text-xs text-red-600 hover:underline"
                >
                  ลบ
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
