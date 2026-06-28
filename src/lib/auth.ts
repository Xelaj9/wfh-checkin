import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AppUser, UserRole } from '@/lib/database.types'

/**
 * ดึงผู้ใช้ปัจจุบัน + profile (role/team)
 * คืน null ถ้ายังไม่ login หรือไม่อยู่ใน whitelist (ไม่มี row ใน public.users)
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !profile.is_active) return null
  return profile
}

/** บังคับต้อง login — ไม่งั้น redirect ไป /login */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

/** บังคับ role — ใช้ป้องกันหน้า/แอ็กชันของ admin */
export async function requireRole(roles: UserRole[]): Promise<AppUser> {
  const user = await requireUser()
  if (!roles.includes(user.role)) redirect('/app')
  return user
}
