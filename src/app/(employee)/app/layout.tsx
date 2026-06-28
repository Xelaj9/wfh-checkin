import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { SignOutButton } from '@/components/ui/sign-out-button'

// Layout พนักงาน — mobile-first
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{user.full_name ?? user.email}</p>
          <p className="text-xs text-slate-400">พนักงาน</p>
        </div>
        <div className="flex items-center gap-3">
          {(user.role === 'admin' || user.role === 'super_admin') && (
            <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-900">
              แอดมิน
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 px-4 py-5">{children}</main>
      <nav className="grid grid-cols-3 border-t text-center text-sm">
        <Link href="/app" className="py-3 hover:bg-slate-50">
          หน้าหลัก
        </Link>
        <Link href="/app/history" className="py-3 hover:bg-slate-50">
          ประวัติ
        </Link>
        <Link href="/app/adjustment" className="py-3 hover:bg-slate-50">
          แก้เวลา
        </Link>
      </nav>
    </div>
  )
}
