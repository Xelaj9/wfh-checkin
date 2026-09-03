import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { SignOutButton } from '@/components/ui/sign-out-button'
import { ThemeToggle } from '@/components/ui/theme-toggle'

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || name[0]?.toUpperCase() || '?'
}

// Layout พนักงาน — mobile-first
export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const name = user.full_name ?? user.email

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {initials(name)}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{name}</p>
            <p className="text-xs text-muted">พนักงาน</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(user.role === 'admin' || user.role === 'super_admin') && (
            <Link href="/admin" className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-slate-100 dark:hover:bg-slate-800">
              แอดมิน
            </Link>
          )}
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-5">{children}</main>

      <nav className="sticky bottom-0 grid grid-cols-4 border-t border-slate-200/70 bg-white/90 text-center text-xs backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <NavItem href="/app" label="หน้าหลัก" icon="M3 9.5 12 3l9 6.5V21H3z" />
        <NavItem href="/app/history" label="ประวัติ" icon="M12 8v5l3 2M21 12a9 9 0 1 1-9-9" />
        <NavItem href="/app/adjustment" label="แก้เวลา" icon="M12 8v5l3 2M21 12a9 9 0 1 1-9-9 M16 3l5 5" />
        <NavItem href="/app/leave" label="วันลา" icon="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2zM9 15l2 2 4-4" />
      </nav>
    </div>
  )
}

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1 py-2.5 text-muted transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      {label}
    </Link>
  )
}
