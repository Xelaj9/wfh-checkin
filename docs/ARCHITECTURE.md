# สถาปัตยกรรมระบบ WFH Check-in

> **หลักการสำคัญ:** ไม่มีระบบไหนกันโกงได้ 100% — เป้าหมายคือทำให้ "โกงยากขึ้นมาก" และ
> "ทุกการโกงต้องทิ้งร่องรอยที่ตรวจย้อนหลังได้" โดยไม่สอดส่องพนักงานเกินจำเป็น

---

## 1. ภาพรวม Tech Stack

| ส่วน | เทคโนโลยี | เหตุผล |
|------|-----------|--------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind | SSR + Server Actions ในที่เดียว |
| Backend | Next.js Server Actions + Route Handlers | logic สำคัญ validate ฝั่ง server |
| DB | Supabase PostgreSQL | RLS ระดับ row ผูกกับ `auth.uid()` |
| Auth | Supabase Auth (Google OAuth) | session ผูกกับ RLS โดยตรง |
| Storage | Supabase Storage (private bucket) | selfie / หลักฐาน + signed URL |
| Deploy | Vercel | |
| Mobile | PWA (manifest + service worker) | ใช้บนมือถือเหมือนแอป |

### ทำไม Supabase Auth ไม่ใช่ NextAuth?
RLS policy ใช้ `auth.uid()` ได้ทันทีเมื่อใช้ Supabase Auth ทำให้ "กันการอ่านข้อมูลคนอื่น"
บังคับที่ชั้น database ไม่ใช่แค่ชั้นแอป — ปลอดภัยกว่าและพลาดยากกว่า

---

## 2. โมเดลความปลอดภัย (Defense in Depth)

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 0: Whitelist  → อีเมลต้องถูกแอดมินเพิ่มก่อน login ได้     │
│ Layer 1: Auth       → Google OAuth + session cookie (httpOnly) │
│ Layer 2: Middleware → refresh session, กันเข้าหน้า protected   │
│ Layer 3: RLS        → บังคับขอบเขตข้อมูลที่ชั้น Postgres        │
│ Layer 4: Server     → Server Action validate + เขียนผ่าน      │
│                       service-role (กัน client ยิงตรง)         │
│ Layer 5: Audit      → ทุก action สำคัญ → audit_logs (insert-only)│
└─────────────────────────────────────────────────────────────┘
```

**กฎเหล็ก:** การเขียน `attendance_records`, `audit_logs`, การให้คะแนน `risk_score`
และการอนุมัติอุปกรณ์ — **ทำที่ฝั่ง server เท่านั้น** ผ่าน service-role client
client ส่งได้แค่ "หลักฐานดิบ" (พิกัด, fingerprint, รูป) แล้ว server เป็นคนตัดสิน status

---

## 3. กลไกกันโกง (Anti-cheat) แมปกับ requirement

| ความเสี่ยง | กลไก | ตาราง/ฟังก์ชัน |
|-----------|------|----------------|
| ฝากเพื่อนกดแทน | ผูกอุปกรณ์ + selfie สด + presence check สุ่ม | `registered_devices`, `presence_checks` |
| ปลอมตำแหน่ง | ตรวจรัศมี + accuracy + เก็บ raw coords ให้แอดมินดู | `work_locations`, `lib/location.ts` |
| เปิดคอมทิ้งไม่ทำงาน | work log + presence check สุ่ม | `work_logs`, `presence_checks` |
| แก้เวลาเอง | ห้ามแก้ตรง — ต้องผ่าน adjustment request + audit | `adjustment_requests`, `audit_logs` |
| สลับ device/IP/timezone | risk scoring | `lib/risk-scoring.ts` |

**สิ่งที่เรา *ไม่* ทำ (privacy / PDPA — ข้อ 17):** ไม่ keylogger, ไม่แอบเปิดกล้อง,
ไม่ screenshot, ไม่ track location ตลอดวัน เก็บตำแหน่ง/กล้อง **เฉพาะ 3 จังหวะ**:
check-in, check-out, random presence check

---

## 4. Risk Scoring (0–100)

คะแนนคำนวณฝั่ง server ตอน check-in/out (ดู `src/lib/risk-scoring.ts`):

| เงื่อนไข | คะแนน |
|----------|-------|
| นอกพื้นที่ที่กำหนด | +35 |
| อุปกรณ์ใหม่ (ยังไม่อนุมัติ) | +30 |
| location accuracy > 1000m | +20 |
| timezone ไม่ตรงประเทศ | +25 |
| IP เปลี่ยน > 3 ครั้ง/วัน | +15 |
| user agent เปลี่ยนผิดปกติ | +15 |
| ปิด location permission | +20 |
| เช็คเอาต์ไม่มี work summary | +10 |
| ไม่ตอบ presence check | +20/ครั้ง |

**Mapping:** `0–30 = normal` · `31–60 = review` · `61–100 = suspicious`

---

## 5. Authentication Flow

```
[Google] → Supabase OAuth → callback (/auth/callback)
   → ตรวจอีเมลใน whitelist (employee_profiles/users)
       ├─ ไม่อยู่ → sign out + แสดง "ไม่ได้รับอนุญาต" + log failed_login
       └─ อยู่   → upsert users row, set role, redirect ตาม role
                    employee  → /app
                    admin     → /admin
                    super_admin → /admin (เห็นทุกทีม)
   → ทุกครั้ง: insert login_history (เวลา, IP, UA, device)
```

---

## 6. Folder Structure

```
src/
  app/
    (auth)/login/              # หน้า login
    auth/callback/route.ts     # OAuth callback + whitelist check
    (employee)/app/            # dashboard พนักงาน (mobile-first)
      check-in/, check-out/, history/, adjustment/
    (admin)/admin/             # dashboard แอดมิน (desktop)
      attendance/, devices/, suspicious/, reports/, settings/, team/
    api/                       # route handlers (signed url, presence ack ฯลฯ)
    privacy/                   # Privacy Notice (PDPA)
  actions/                     # Server Actions (check-in, adjustment, admin)
  components/                  # UI components (ui/, employee/, admin/)
  lib/
    supabase/                  # client.ts, server.ts, admin.ts, middleware.ts
    risk-scoring.ts            # คำนวณ risk_score
    device-fingerprint.ts      # สร้าง fingerprint แบบ privacy-friendly
    location.ts                # ตรวจรัศมี / haversine
    audit.ts                   # helper เขียน audit log
    auth.ts                    # getSession, requireRole
    database.types.ts          # generated types จาก Supabase
  middleware.ts                # refresh session + route guard
supabase/
  migrations/                  # 0001_schema, 0002_rls, 0003_functions
  seed.sql                     # ข้อมูลตัวอย่าง
docs/                          # ARCHITECTURE.md (ไฟล์นี้), DEPLOY.md
```

---

## 7. แผนการพัฒนา (Phases)

- **Phase 1** — Google login, roles, check-in/out, capture location+device+IP, admin dashboard, attendance table, audit log
- **Phase 2** — registered device approval, suspicious scoring, adjustment request, reports export, work log
- **Phase 3** — selfie verification, random presence check, notification, analytics, data retention

Schema ออกแบบครบทุก phase ตั้งแต่ต้น (กัน migration ใหญ่ภายหลัง) แต่ implement ทีละ phase
