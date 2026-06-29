import Link from 'next/link'
import { GoogleLoginButton } from '@/components/auth/google-login-button'
import { DevLogin } from '@/components/auth/dev-login'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4 dark:from-slate-950 dark:to-slate-900">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="card w-full max-w-sm p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl shadow-lg shadow-brand-600/30">
            <span className="text-white">⏱</span>
          </div>
          <h1 className="text-xl font-bold">WFH Check-in</h1>
          <p className="mt-1 text-sm text-muted">เข้าสู่ระบบด้วยบัญชี Google ของบริษัท</p>
        </div>

        {searchParams.error === 'not_whitelisted' && (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            อีเมลนี้ยังไม่ได้รับอนุญาตให้ใช้งาน กรุณาติดต่อผู้ดูแลระบบ
          </div>
        )}
        {searchParams.error === 'auth' && (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </div>
        )}

        <GoogleLoginButton />

        {process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === 'true' && <DevLogin />}

        <p className="mt-6 text-center text-xs text-muted">
          การใช้งานถือว่ายอมรับ{' '}
          <Link href="/privacy" className="underline hover:text-brand-600">
            นโยบายความเป็นส่วนตัว
          </Link>
        </p>
      </div>
    </main>
  )
}
