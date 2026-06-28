import { signOutAction } from '@/actions/auth'

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button className="text-sm text-slate-500 hover:text-slate-900">ออกจากระบบ</button>
    </form>
  )
}
