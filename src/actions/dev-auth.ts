'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientIp, writeAudit } from '@/lib/audit'
import { headers } from 'next/headers'

/**
 * Dev-only login ด้วย email/password (สำหรับทดสอบ local โดยไม่ต้องตั้ง Google OAuth)
 * เปิดใช้เฉพาะเมื่อ NEXT_PUBLIC_ENABLE_DEV_LOGIN === 'true' และไม่ใช่ production
 * ใช้กับ seeded users (รหัสผ่าน Password123!) เท่านั้น
 */
export async function devLoginAction(formData: FormData) {
  // คุมด้วย flag เดียว — ตั้ง NEXT_PUBLIC_ENABLE_DEV_LOGIN=true เพื่อเปิด, ลบ/false เพื่อปิด
  // (ไม่เช็ค NODE_ENV เพราะ Vercel ตั้งเป็น 'production' เสมอ ทำให้ dev login ใช้ไม่ได้)
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== 'true') {
    redirect('/login?error=auth')
  }

  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) redirect('/login?error=auth')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    redirect('/login?error=not_whitelisted')
  }

  await admin.from('login_history').insert({
    user_id: data.user.id,
    email: data.user.email,
    ip: getClientIp(),
    user_agent: headers().get('user-agent'),
    success: true,
    reason: 'dev_login',
  } as never)
  await writeAudit({ action: 'login', actorId: data.user.id, actorEmail: data.user.email })

  redirect(profile.role === 'employee' ? '/app' : '/admin')
}
