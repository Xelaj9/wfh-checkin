import Link from 'next/link'
import { GoogleLoginButton } from '@/components/auth/google-login-button'
import { DevLogin } from '@/components/auth/dev-login'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
            ⏱
          </div>
          <h1 className="text-xl font-bold">WFH Check-in</h1>
          <p className="mt-1 text-sm text-slate-500">
            เข้าสู่ระบบด้วยบัญชี Google ของบริษัท
          </p>
        </div>

        {searchParams.error === 'not_whitelisted' && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            อีเมลนี้ยังไม่ได้รับอนุญาตให้ใช้งาน กรุณาติดต่อผู้ดูแลระบบ
          </div>
        )}
        {searchParams.error === 'auth' && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
          </div>
        )}

        <GoogleLoginButton />

        {process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === 'true' && <DevLogin />}

        <p className="mt-6 text-center text-xs text-slate-400">
          การใช้งานถือว่ายอมรับ{' '}
          <Link href="/privacy" className="underline">
            นโยบายความเป็นส่วนตัว
          </Link>
        </p>
      </div>
    </main>
  )
}
