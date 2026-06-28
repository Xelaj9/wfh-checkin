import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

// หน้าแรก: ส่งต่อไปยัง dashboard ตาม role
export default async function Home() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role === 'employee') redirect('/app')
  redirect('/admin')
}
