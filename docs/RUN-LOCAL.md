# รันจริงด้วย Cloud Supabase (ไม่ต้องลง Docker)

> เครื่องนี้ไม่มี Docker/Supabase CLI จึงใช้ **Cloud Supabase (ฟรี)** เป็น backend
> แล้วรัน Next.js บนเครื่อง — กดเช็คอินได้จริงผ่าน **dev login** (ไม่ต้องตั้ง Google OAuth ก็ทดสอบได้)

---

## ขั้นที่ 1 — สร้างโปรเจกต์ Supabase
1. ไปที่ https://supabase.com → **New project** (เลือก region สิงคโปร์เพื่อความเร็ว)
2. ตั้งรหัส database แล้วรอสร้างเสร็จ (~2 นาที)

## ขั้นที่ 2 — รัน SQL ทั้งหมด
1. เปิด **SQL Editor** ในโปรเจกต์
2. เปิดไฟล์ [`supabase/combined.sql`](../supabase/combined.sql) ก็อปทั้งหมดไปวาง → กด **Run**
   - ไฟล์นี้รวม schema + functions + RLS + storage + seed (รวม demo users)
   - ถ้าเจอ error ซ้ำเพราะรันสองรอบ ให้ลบ schema แล้วรันใหม่ หรือสร้างโปรเจกต์ใหม่

## ขั้นที่ 3 — เอา keys มาใส่ .env.local
1. ไปที่ **Project Settings → API** จะเห็น:
   - `Project URL`
   - `anon public` key
   - `service_role` key (อยู่ใต้ Project API keys — กดเผยให้เห็น)
2. ที่โฟลเดอร์โปรเจกต์ สร้างไฟล์ `.env.local`:

```bash
cp .env.example .env.local
```

3. แก้ค่าให้ตรง:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_TIMEZONE=Asia/Bangkok
CRON_SECRET=any-long-random-string
NEXT_PUBLIC_ENABLE_DEV_LOGIN=true
```

## ขั้นที่ 4 — รัน
```bash
npm install      # ถ้ายังไม่ได้ลง
npm run dev
```
เปิด http://localhost:3000 → จะเด้งไป `/login`

## ขั้นที่ 5 — ล็อกอินทดสอบ + เช็คอิน
หน้า login จะมีกล่อง **"โหมดทดสอบ (dev login)"** (เพราะตั้ง `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true`)

| อีเมล | รหัส | บทบาท |
|-------|------|-------|
| `emp1@example.com` | `Password123!` | พนักงาน (มี geofence + อุปกรณ์อนุมัติแล้ว) |
| `manager@example.com` | `Password123!` | ผู้จัดการทีม A |
| `superadmin@example.com` | `Password123!` | Super Admin (เห็นทุกทีม + หน้าตั้งค่า) |

1. ล็อกอินด้วย `emp1@example.com` → เข้าหน้าพนักงาน
2. กด **เช็คอินเข้างาน** → เบราว์เซอร์จะขอตำแหน่ง (อนุญาต)
   - ถ้าพิกัดอยู่ใน geofence ที่ seed ไว้ (สาทร) → สถานะ `ปกติ`
   - ถ้าอยู่ที่อื่น → ขึ้น `รอตรวจสอบ/ผิดปกติ` (ดีต่อการทดสอบ risk scoring!)
3. ล็อกอินอีก browser/incognito ด้วย `manager@` → เห็นรายการเช็คอินใน `/admin`,
   หน้า **ผิดปกติ** จะเห็นแผนที่พิกัด + signed URL ของ selfie (ถ้าเปิด)

## เปิดทดสอบ selfie / presence
- `superadmin@` → หน้า **ตั้งค่า** → เปิด "บังคับ selfie" → พนักงานต้องถ่ายรูปก่อนเช็คอิน
- presence check: เรียก cron ด้วยมือเพื่อทดสอบ
  ```bash
  curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/presence
  ```
  แล้วรีเฟรชหน้าพนักงานที่กำลังทำงาน จะเห็นแบนเนอร์ให้ยืนยันตัวตน

---

## ถ้าต้องการ Google login จริง (production-like)
1. Supabase → **Authentication → Providers → Google** → เปิด แล้วใส่ Client ID/Secret
   จาก Google Cloud Console (OAuth consent + Credentials)
2. ใส่ Authorized redirect: `https://xxxx.supabase.co/auth/v1/callback`
3. ปิด `NEXT_PUBLIC_ENABLE_DEV_LOGIN` แล้วใช้ปุ่ม "เข้าสู่ระบบด้วย Google"
   (อีเมลต้องอยู่ใน `allowed_emails` ก่อน ไม่งั้นถูกปฏิเสธ)
