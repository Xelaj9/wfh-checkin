import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { SignOutButton } from '@/components/ui/sign-out-button'

const NAV = [
  { href: '/admin', label: 'ภาพรวม' },
  { href: '/admin/attendance', label: 'การเข้างาน' },
  { href: '/admin/suspicious', label: 'ผิดปกติ' },
  { href: '/admin/devices', label: 'อุปกรณ์' },
  { href: '/admin/adjustments', label: 'คำขอแก้เวลา' },
  { href: '/admin/reports', label: 'รายงาน' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(['admin', 'super_admin'])

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-white p-4 md:flex">
        <div className="mb-6 font-bold">WFH Admin</div>
        <nav className="flex flex-1 flex-col gap-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 hover:bg-slate-100">
              {n.label}
            </Link>
          ))}
          <Link href="/admin/team" className="rounded-lg px-3 py-2 hover:bg-slate-100">
            ผู้ใช้ & พื้นที่
          </Link>
          {user.role === 'super_admin' && (
            <Link href="/admin/settings" className="rounded-lg px-3 py-2 hover:bg-slate-100">
              ตั้งค่า
            </Link>
          )}
        </nav>
        <div className="border-t pt-3">
          <p className="text-sm font-medium">{user.full_name ?? user.email}</p>
          <p className="mb-2 text-xs text-slate-400">
            {user.role === 'super_admin' ? 'Super Admin' : 'ผู้จัดการทีม'}
          </p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 p-6">{children}</main>
    </div>
  )
}
