import { devLoginAction } from '@/actions/dev-auth'

/**
 * ฟอร์ม dev login — render เฉพาะเมื่อเปิด flag (ดู login/page.tsx)
 * เติมค่า seeded user ไว้ให้กดทดสอบได้เร็ว
 */
export function DevLogin() {
  return (
    <form action={devLoginAction} className="mt-5 space-y-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
      <p className="text-xs font-medium text-amber-800">โหมดทดสอบ (dev login)</p>
      <input
        name="email"
        type="email"
        defaultValue="emp1@example.com"
        className="w-full rounded-lg border px-3 py-2 text-sm"
        placeholder="email"
      />
      <input
        name="password"
        type="password"
        defaultValue="Password123!"
        className="w-full rounded-lg border px-3 py-2 text-sm"
        placeholder="password"
      />
      <button className="w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white">
        เข้าสู่ระบบ (ทดสอบ)
      </button>
      <p className="text-[11px] text-amber-700">
        seeded: superadmin@ / manager@ / emp1@ / emp2@example.com · รหัส Password123!
      </p>
    </form>
  )
}
