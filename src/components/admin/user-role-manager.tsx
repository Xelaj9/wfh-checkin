'use client'

import { useState, useTransition } from 'react'
import { changeUserRoleAction } from '@/actions/manage'

interface Member {
  id: string
  full_name: string | null
  email: string
  role: string
}

const ROLE_LABEL: Record<string, string> = {
  employee: 'พนักงาน',
  admin: 'ผู้จัดการ',
  super_admin: 'Super Admin',
}

/** ตารางเปลี่ยนสิทธิ์ผู้ใช้ — เฉพาะ super_admin (เปลี่ยนได้ตลอดเวลา มีผลทันที) */
export function UserRoleManager({ members, myId }: { members: Member[]; myId: string }) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function change(userId: string, role: string) {
    setMsg(null)
    startTransition(async () => {
      const res = await changeUserRoleAction({ userId, role })
      setMsg(res.ok ? { ok: true, text: 'เปลี่ยนสิทธิ์แล้ว' } : { ok: false, text: res.error })
    })
  }

  return (
    <div className="rounded-xl border bg-white dark:bg-slate-900 p-5">
      <h2 className="mb-1 font-semibold">สิทธิ์ผู้ใช้ (Super Admin)</h2>
      <p className="mb-3 text-sm text-muted">เปลี่ยนบทบาทได้ตลอดเวลา มีผลทันทีที่ผู้ใช้โหลดหน้าใหม่</p>

      {msg && (
        <p
          className={`mb-3 rounded-lg p-2 text-sm ${
            msg.ok
              ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
          }`}
        >
          {msg.text}
        </p>
      )}

      <table className="w-full text-sm">
        <thead className="text-left text-muted">
          <tr>
            <th className="py-1">ผู้ใช้</th>
            <th className="py-1">บทบาท</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
          {members.map((m) => (
            <tr key={m.id}>
              <td className="py-2">
                <span className="font-medium">{m.full_name ?? m.email}</span>
                <span className="ml-2 text-xs text-muted">{m.email}</span>
              </td>
              <td className="py-2">
                {m.id === myId ? (
                  // ตัวเอง: แสดงเฉย ๆ (เปลี่ยนสิทธิ์ตัวเองไม่ได้ กันล็อกตัวเองออก)
                  <span className="text-muted">{ROLE_LABEL[m.role] ?? m.role} (คุณ)</span>
                ) : (
                  <select
                    defaultValue={m.role}
                    disabled={isPending}
                    onChange={(e) => change(m.id, e.target.value)}
                    className="text-sm"
                  >
                    <option value="employee">พนักงาน</option>
                    <option value="admin">ผู้จัดการ</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
