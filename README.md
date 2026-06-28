# WFH Check-in — ระบบเช็คอินเวลาเข้างานพนักงาน Work From Home

ระบบเช็คอิน/เช็คเอาต์ที่เน้น **ลดโอกาสโกงเวลา** ด้วยการยืนยันตัวตนเป็นช่วง ๆ + ตรวจจับความผิดปกติ
+ วัดงานจริง + audit log โดย **ไม่สอดส่องพนักงานเกินจำเป็น**

> หลักการ: ไม่มีระบบไหนกันโกงได้ 100% — แต่ระบบนี้ทำให้โกงยากขึ้นมาก และทุกการโกงทิ้งร่องรอยตรวจสอบได้

## Tech Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Supabase** PostgreSQL + Auth (Google) + Storage
- Server Actions / Route Handlers สำหรับ logic ฝั่ง server
- Deploy บน **Vercel**, รองรับ **PWA**

ดูสถาปัตยกรรมเต็มที่ [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## โครงสร้างหลัก

```
src/
  app/            หน้า (employee / admin / auth / api)
  actions/        Server Actions (check-in, admin, auth)
  components/     UI components
  lib/            supabase clients, risk-scoring, device-fingerprint, location, audit
supabase/
  migrations/     0001 schema · 0002 functions · 0003 RLS · 0004 storage
  seed.sql        ข้อมูลตัวอย่าง
```

## ความสามารถตาม Phase

- **Phase 1 (เสร็จ):** Google login + whitelist, roles, check-in/out, เก็บ location/device/IP,
  risk scoring, admin dashboard + ตาราง attendance พร้อม filter, audit log, export CSV, Privacy Notice
- **Phase 2 (เสร็จ):** device approval, adjustment request (พนักงานส่ง + แอดมินอนุมัติ → apply เข้า attendance + audit),
  work log ระหว่างวัน (planned/in_progress/done/blocked), reports + export
- **Phase 3 (เสร็จ):** selfie verification (กล้องสด → private bucket + signed URL ให้แอดมิน),
  random presence check (cron สุ่ม + แบนเนอร์ยืนยัน + missed handling), notification (DB + presence banner),
  data retention/anonymize (cron), settings UI (super_admin) + จัดการ whitelist/work location

### Cron (Vercel) — Phase 3
ตั้งค่าใน [`vercel.json`](vercel.json) แล้ว เรียกอัตโนมัติเมื่อ deploy:
- `/api/cron/presence` — สุ่มสร้าง presence check + ปิดที่หมดเวลาเป็น `missed`
- `/api/cron/retention` — ลบ login history เก่า + anonymize พิกัด/IP/selfie ตาม retention period

ต้องตั้ง env `CRON_SECRET` (Vercel จะแนบ `Authorization: Bearer <CRON_SECRET>` ให้อัตโนมัติ)

## ติดตั้งสำหรับพัฒนา (Local)

### 1. ติดตั้ง dependencies
```bash
npm install
```

### 2. เตรียม Supabase (เลือกอย่างใดอย่างหนึ่ง)

> 🚀 **เริ่มเร็วสุด (ไม่ต้องลง Docker):** ทำตาม [`docs/RUN-LOCAL.md`](docs/RUN-LOCAL.md) —
> ใช้ Cloud Supabase + paste ไฟล์เดียว [`supabase/combined.sql`](supabase/combined.sql) +
> ล็อกอินทดสอบด้วย **dev login** (เปิด `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true`) กดเช็คอินได้จริงทันที

**ก) Supabase แบบ local** — ต้องมี [Supabase CLI](https://supabase.com/docs/guides/cli) + Docker
```bash
supabase start          # ยกฐานข้อมูล local ขึ้นมา
supabase db reset       # รัน migrations + seed.sql
```

**ข) Supabase Cloud** — สร้างโปรเจกต์ที่ supabase.com แล้ว paste `supabase/combined.sql` ลงใน SQL Editor

### 3. ตั้งค่า environment
```bash
cp .env.example .env.local
```
แล้วใส่ค่า `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### 4. ตั้งค่า Google OAuth
1. สร้าง OAuth Client ID ที่ [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Authorized redirect URI:
   - Local: `http://localhost:54321/auth/v1/callback`
   - Cloud: `https://<project>.supabase.co/auth/v1/callback`
3. ใส่ Client ID/Secret ใน Supabase Dashboard → Authentication → Providers → Google
   (หรือ env `SUPABASE_AUTH_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_GOOGLE_SECRET` สำหรับ local)

### 5. รัน
```bash
npm run dev
```
เปิด http://localhost:3000

## การเพิ่มพนักงาน (Whitelist)

พนักงานจะ login ได้ก็ต่อเมื่ออีเมลอยู่ในตาราง `allowed_emails` เท่านั้น
- แก้อีเมลใน `supabase/seed.sql` เป็นอีเมล Google จริงของคุณ แล้ว `supabase db reset`
- หรือ insert แถวใหม่ในตาราง `allowed_emails` (ระบุ `email`, `role`, `team_id`)

บัญชีตัวอย่างใน seed (สำหรับ local, login แบบ email/password ได้): รหัสผ่าน `Password123!`
| อีเมล | role |
|-------|------|
| superadmin@example.com | super_admin |
| manager@example.com | admin |
| emp1@example.com / emp2@example.com | employee |

## ทดสอบ flow กันโกง

1. login เป็น `emp1` → เช็คอิน (อนุญาตตำแหน่ง) → ได้สถานะ `normal`
2. ปฏิเสธตำแหน่ง หรืออยู่นอกพิกัด seed → สถานะ `pending_review`/`suspicious` + risk เพิ่ม
3. เช็คอินจาก browser อื่น (fingerprint ใหม่) → อุปกรณ์ขึ้น `pending_review`
4. login เป็น `manager` → ดู dashboard, filter `ผิดปกติ`/`มาสาย`, อนุมัติอุปกรณ์, export CSV
5. ตรวจ `audit_logs` ว่าทุก action ถูกบันทึก

## คำสั่งที่มีให้

| คำสั่ง | ทำอะไร |
|--------|--------|
| `npm run dev` | dev server |
| `npm run build` | build production |
| `npm run typecheck` | ตรวจ TypeScript |
| `npm test` | รัน unit tests (risk-scoring, geofence) |
| `npm run db:reset` | รัน migrations + seed ใหม่ (local) |
| `npm run db:types` | generate types จาก schema |

Deploy → ดู [`docs/DEPLOY.md`](docs/DEPLOY.md)
