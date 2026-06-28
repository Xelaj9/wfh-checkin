# วิธี Deploy ขึ้น Vercel

## 1. เตรียม Supabase (Production)

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com)
2. รัน SQL ตามลำดับใน **SQL Editor**:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_functions.sql`
   - `supabase/migrations/0003_rls.sql`
   - `supabase/migrations/0004_storage.sql`
   - (ตัวเลือก) `supabase/seed.sql` — **แก้อีเมล whitelist เป็นของจริงก่อน** และลบ block demo `auth.users` ออกถ้าใช้ Google จริง
   หรือใช้ CLI: `supabase link --project-ref <ref>` แล้ว `supabase db push`
3. เก็บค่าจาก **Project Settings → API**: `Project URL`, `anon key`, `service_role key`

## 2. ตั้งค่า Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → สร้าง OAuth Client ID (Web)
2. **Authorized redirect URI**: `https://<project>.supabase.co/auth/v1/callback`
3. Supabase Dashboard → **Authentication → Providers → Google** → ใส่ Client ID/Secret → Enable
4. **Authentication → URL Configuration**:
   - Site URL: `https://<your-app>.vercel.app`
   - Redirect URLs: เพิ่ม `https://<your-app>.vercel.app/auth/callback`

## 3. Deploy ที่ Vercel

1. push โค้ดขึ้น GitHub แล้ว **Import** repo ที่ [vercel.com/new](https://vercel.com/new)
2. ตั้ง **Environment Variables** (ทั้ง Production + Preview):

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (⚠️ ไม่ public) |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` |
   | `NEXT_PUBLIC_DEFAULT_TIMEZONE` | `Asia/Bangkok` |
   | `CRON_SECRET` | สตริงสุ่มยาว ๆ (ป้องกัน endpoint `/api/cron/*`) |

3. กด **Deploy**

## 4. หลัง deploy

- เพิ่มอีเมล Google ของแอดมินคนแรกใน `allowed_emails` (role = `super_admin`) ผ่าน SQL Editor
- ทดสอบ login → ควร redirect เข้า `/admin`
- ตรวจว่า **HTTPS** ทำงาน (geolocation + camera ต้องใช้ secure context เท่านั้น)
- ตรวจ Storage bucket `evidence` เป็น **private** (ไม่ public)

## 5. ข้อควรระวัง Production

- **service_role key** ต้องอยู่เฉพาะฝั่ง server เท่านั้น — โค้ดใช้ผ่าน `src/lib/supabase/admin.ts`
- เปิด **RLS** ครบทุกตาราง (migration 0003 ทำให้แล้ว) — อย่าปิด
- ตั้ง **rate limit** ที่ระดับ Vercel/edge หรือ Supabase สำหรับ endpoint เช่น check-in (Phase ถัดไป)
- **Cron พร้อมใช้แล้ว** ใน `vercel.json` (Vercel จะลงทะเบียนให้ตอน deploy):
  - `/api/cron/presence` (ทุก 15 นาที จ–ศ 08:00–19:00) — สุ่ม presence check + ปิดที่หมดเวลาเป็น `missed`
  - `/api/cron/retention` (ตี 3 ทุกวัน) — ลบ/anonymize ข้อมูลเกิน retention period
  - ต้องตั้ง env `CRON_SECRET` (ไม่งั้น endpoint จะตอบ 401)
