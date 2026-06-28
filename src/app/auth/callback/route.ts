import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientIp, writeAudit } from '@/lib/audit'
import { headers } from 'next/headers'

/**
 * OAuth callback:
 * 1. แลก code → session
 * 2. ตรวจ whitelist (มี row ใน public.users ที่ active หรือไม่ — trigger สร้างให้เฉพาะอีเมลใน allowed_emails)
 * 3. ไม่อยู่ whitelist → sign out + log failed_login + กลับหน้า login
 * 4. อยู่ whitelist → log login + redirect ตาม role
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  const supabase = createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  const admin = createAdminClient()
  const ua = headers().get('user-agent')
  const ip = getClientIp()

  const { data: profile } = await admin
    .from('users')
    .select('id, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  // ไม่อยู่ใน whitelist หรือถูกปิดใช้งาน
  if (!profile || !profile.is_active) {
    await admin.from('login_history').insert({
      user_id: null,
      email: user.email,
      ip,
      user_agent: ua,
      success: false,
      reason: 'not_whitelisted',
    } as never)
    await writeAudit({
      action: 'failed_login',
      actorEmail: user.email,
      metadata: { reason: 'not_whitelisted' },
    })
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=not_whitelisted`)
  }

  // login สำเร็จ
  await admin.from('login_history').insert({
    user_id: user.id,
    email: user.email,
    ip,
    user_agent: ua,
    success: true,
  } as never)
  await writeAudit({
    action: 'login',
    actorId: user.id,
    actorEmail: user.email,
  })

  const dest = profile.role === 'employee' ? '/app' : '/admin'
  return NextResponse.redirect(`${origin}${dest}`)
}
