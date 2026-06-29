import { requireRole } from '@/lib/auth'
import { SignOutButton } from '@/components/ui/sign-out-button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { AdminNav } from '@/components/admin/admin-nav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(['admin', 'super_admin'])
  const isSuper = user.role === 'super_admin'
  const name = user.full_name ?? user.email

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar (เดสก์ท็อป) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="mb-6 flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">⏱</div>
          <span className="font-bold">WFH Admin</span>
        </div>
        <AdminNav isSuperAdmin={isSuper} />
        <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-slate-800">
          <p className="text-sm font-medium">{name}</p>
          <p className="mb-2 text-xs text-muted">{isSuper ? 'Super Admin' : 'ผู้จัดการทีม'}</p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (มือถือ) */}
        <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm text-white">⏱</div>
              <span className="font-semibold">WFH Admin</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
          <AdminNav isSuperAdmin={isSuper} variant="top" />
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
