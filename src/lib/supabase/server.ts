import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Supabase client สำหรับ Server Components / Server Actions / Route Handlers
 * ผูกกับ session cookie ของผู้ใช้ → RLS ทำงานตาม auth.uid()
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // ถูกเรียกจาก Server Component — middleware จะ refresh session ให้แทน
          }
        },
      },
    }
  )
}
