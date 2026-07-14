'use client'

import { useTransition } from 'react'
import { assignShiftAction } from '@/actions/shifts'
import type { Shift } from '@/lib/database.types'

interface Emp {
  id: string
  full_name: string | null
  email: string
  shift_id: string | null
}

const hhmm = (t: string) => t?.slice(0, 5) ?? ''

/** ตารางจับพนักงานเข้ากะ — เปลี่ยน select แล้วบันทึกทันที */
export function ShiftAssignTable({ employees, shifts }: { employees: Emp[]; shifts: Shift[] }) {
  const [isPending, startTransition] = useTransition()

  function assign(userId: string, shiftId: string) {
    startTransition(async () => {
      await assignShiftAction({ userId, shiftId: shiftId || null })
    })
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold">จับพนักงานเข้ากะ</h2>
      <p className="mb-3 -mt-2 text-xs text-muted">รายชื่อจะขึ้นหลังพนักงาน login ด้วย Google ครั้งแรก</p>
      {employees.length === 0 ? (
        <p className="text-sm text-muted">ยังไม่มีพนักงาน</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-1">พนักงาน</th>
              <th className="py-1">กะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="py-2">{e.full_name ?? e.email}</td>
                <td className="py-2">
                  <select
                    defaultValue={e.shift_id ?? ''}
                    disabled={isPending}
                    onChange={(ev) => assign(e.id, ev.target.value)}
                    className="text-sm"
                  >
                    <option value="">— ไม่กำหนด (ใช้เวลาทีม) —</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({hhmm(s.start_time)}–{hhmm(s.end_time)})
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
