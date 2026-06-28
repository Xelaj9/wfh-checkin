import { requireRole } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { SettingsForm } from '@/components/admin/settings-form'

// ตั้งค่าเงื่อนไขการเช็คอิน (super_admin) — แก้ไขได้จริง + audit log
export default async function SettingsPage() {
  await requireRole(['super_admin'])
  const settings = await getSettings()

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">ตั้งค่าระบบ</h1>
        <p className="text-sm text-slate-500">การเปลี่ยนแปลงถูกบันทึกใน audit log</p>
      </div>
      <SettingsForm initial={settings} />
    </div>
  )
}
