'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface NavItem {
  href: string
  label: string
  icon: string
}

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'ภาพรวม', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3' },
  { href: '/admin/attendance', label: 'การเข้างาน', icon: 'M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z' },
  { href: '/admin/suspicious', label: 'ผิดปกติ', icon: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z' },
  { href: '/admin/devices', label: 'อุปกรณ์', icon: 'M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 20h8' },
  { href: '/admin/leaves', label: 'วันลา', icon: 'M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2zM9 15l2 2 4-4' },
  { href: '/admin/adjustments', label: 'คำขอแก้เวลา', icon: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
  { href: '/admin/reports', label: 'รายงาน', icon: 'M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z' },
  { href: '/admin/stats', label: 'สถิติ', icon: 'M3 3v18h18M7 14l3-3 3 3 5-5' },
  { href: '/admin/team', label: 'ผู้ใช้ & พื้นที่', icon: 'M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m6-1.13a4 4 0 1 0-4-4 4 4 0 0 0 4 4z' },
]

export function AdminNav({
  isSuperAdmin,
  variant = 'sidebar',
}: {
  isSuperAdmin: boolean
  variant?: 'sidebar' | 'top'
}) {
  const pathname = usePathname()
  const items = [...ADMIN_NAV]
  if (isSuperAdmin)
    items.push({ href: '/admin/settings', label: 'ตั้งค่า', icon: 'M10.3 4.3 9 7l-2.7-.7a1 1 0 0 0-1 .5L4 9.2a1 1 0 0 0 .2 1.2L6.3 12l-2 1.6a1 1 0 0 0-.2 1.2l1.3 2.4a1 1 0 0 0 1 .5L9 17l1.3 2.7a1 1 0 0 0 1 .6h2.5a1 1 0 0 0 1-.6L16 17l2.7.7a1 1 0 0 0 1-.5l1.3-2.4a1 1 0 0 0-.2-1.2L18.7 12l2-1.6a1 1 0 0 0 .2-1.2l-1.3-2.4a1 1 0 0 0-1-.5L16 7l-1.3-2.7a1 1 0 0 0-1-.6h-2.5a1 1 0 0 0-.9.6z M12 12m-2.5 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0' })

  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href))

  if (variant === 'top') {
    return (
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:hidden">
        {items.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
              isActive(n.href)
                ? 'bg-brand-600 text-white'
                : 'text-muted hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    )
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 text-sm">
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 transition ${
            isActive(n.href)
              ? 'bg-brand-600 font-medium text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d={n.icon} />
          </svg>
          {n.label}
        </Link>
      ))}
    </nav>
  )
}
