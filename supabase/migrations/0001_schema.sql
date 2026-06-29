-- =============================================================================
-- WFH Check-in — Database Schema (Postgres / Supabase)
-- ครอบคลุมทุก Phase ตั้งแต่ต้นเพื่อกัน migration ใหญ่ภายหลัง
-- ทุกตารางมี: id, created_at, updated_at, (created_by / deleted_at เมื่อจำเป็น)
-- =============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type user_role as enum ('super_admin', 'admin', 'employee');
create type attendance_status as enum ('normal', 'pending_review', 'suspicious');
create type device_status as enum ('pending_review', 'approved', 'rejected', 'revoked');
create type presence_status as enum ('pending', 'acknowledged', 'missed');
create type work_log_status as enum ('planned', 'in_progress', 'done', 'blocked');
create type adjustment_status as enum ('pending', 'approved', 'rejected');
create type risk_level as enum ('normal', 'review', 'suspicious');

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- TEAMS
-- ---------------------------------------------------------------------------
create table teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  timezone    text not null default 'Asia/Bangkok',
  -- ค่าเริ่มต้นของทีม (override ได้ที่ app_settings ระดับบริษัท)
  work_start  time not null default '09:00',          -- เวลาเข้างานของกะ (ใช้คำนวณ "มาสาย")
  work_end    time not null default '18:00',           -- เวลาเลิกงานของกะ
  late_grace_minutes int not null default 15,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  deleted_at  timestamptz
);
create trigger trg_teams_updated before update on teams
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- USERS  (เชื่อมกับ auth.users ของ Supabase ผ่าน id เดียวกัน)
-- whitelist = มี row ใน users (is_active = true) เท่านั้นจึงใช้งานได้
-- ---------------------------------------------------------------------------
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  avatar_url  text,
  role        user_role not null default 'employee',
  team_id     uuid references teams(id) on delete set null,
  is_active   boolean not null default true,            -- ปิด = ห้ามใช้งาน
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references users(id),
  deleted_at  timestamptz
);
create index idx_users_team on users(team_id);
create index idx_users_email on users(email);
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();

-- ตารางอีเมลที่อนุญาต (whitelist) — แอดมินเพิ่มก่อนพนักงาน login
-- แยกจาก users เพื่อรองรับการ "เชิญ" ก่อนที่ผู้ใช้จะเคย login จริง
create table allowed_emails (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  role        user_role not null default 'employee',
  team_id     uuid references teams(id) on delete set null,
  full_name   text,
  used_at     timestamptz,                              -- ครั้งแรกที่ login สำเร็จ
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references users(id),
  deleted_at  timestamptz
);
create index idx_allowed_emails_email on allowed_emails(lower(email));
create trigger trg_allowed_emails_updated before update on allowed_emails
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- EMPLOYEE PROFILES
-- ---------------------------------------------------------------------------
create table employee_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references users(id) on delete cascade,
  employee_code   text unique,
  phone           text,
  position        text,
  -- จำนวนอุปกรณ์หลักที่อนุญาต (เช่น มือถือ 1 + คอม 1)
  max_devices     int not null default 2,
  consent_at      timestamptz,                          -- ยอมรับ Privacy Notice เมื่อใด
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references users(id),
  deleted_at      timestamptz
);
create trigger trg_employee_profiles_updated before update on employee_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- WORK LOCATIONS  (พื้นที่ที่อนุญาตให้เช็คอิน ต่อพนักงาน)
-- ---------------------------------------------------------------------------
create table work_locations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  label         text not null,                          -- เช่น "บ้าน", "คอนโด"
  latitude      double precision not null,
  longitude     double precision not null,
  radius_meters int not null default 200,               -- รัศมีที่อนุญาต (100–300 ปกติ)
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references users(id),
  deleted_at    timestamptz
);
create index idx_work_locations_user on work_locations(user_id);
create trigger trg_work_locations_updated before update on work_locations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- REGISTERED DEVICES  (ผูกอุปกรณ์กันฝากกดแทน)
-- fingerprint เป็น hash ของสัญญาณที่ไม่ละเมิด privacy (browser/os/screen/tz/ua)
-- ---------------------------------------------------------------------------
create table registered_devices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  fingerprint     text not null,                        -- hash (ดู lib/device-fingerprint.ts)
  label           text,                                 -- "iPhone ของ A", "คอมที่บ้าน"
  -- เก็บ component แบบอ่านง่ายไว้ให้แอดมินตรวจ (ไม่ใช่ข้อมูลละเอียดส่วนตัว)
  browser         text,
  os              text,
  screen          text,
  timezone        text,
  user_agent      text,
  status          device_status not null default 'pending_review',
  last_seen_at    timestamptz,
  approved_by     uuid references users(id),
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references users(id),
  deleted_at      timestamptz,
  unique (user_id, fingerprint)
);
create index idx_devices_user on registered_devices(user_id);
create index idx_devices_status on registered_devices(status);
create trigger trg_devices_updated before update on registered_devices
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- ATTENDANCE RECORDS  (1 row = 1 วันทำงานของพนักงาน)
-- duplicate check-in กันด้วย unique (user_id, work_date)
-- ---------------------------------------------------------------------------
create table attendance_records (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  team_id             uuid references teams(id) on delete set null,
  work_date           date not null,                    -- คำนวณตาม timezone บริษัท

  -- check-in
  check_in_time       timestamptz,
  check_in_lat        double precision,
  check_in_lng        double precision,
  check_in_accuracy   double precision,                 -- เมตร
  check_in_ip         inet,
  check_in_device_id  uuid references registered_devices(id),
  check_in_within_geofence boolean,
  check_in_selfie_path text,                            -- path ใน storage (private)
  work_plan           text,                             -- แผนงานวันนี้
  is_late             boolean not null default false,

  -- check-out
  check_out_time      timestamptz,
  check_out_lat       double precision,
  check_out_lng       double precision,
  check_out_accuracy  double precision,
  check_out_ip        inet,
  check_out_device_id uuid references registered_devices(id),
  work_summary        text,                             -- สรุปงาน
  completed_work      text,
  issues_faced        text,

  -- risk
  risk_score          int not null default 0,           -- 0–100
  risk_level          risk_level not null default 'normal',
  risk_factors        jsonb not null default '[]',      -- รายการเหตุผล
  status              attendance_status not null default 'normal',

  worked_minutes      int,                              -- คำนวณตอน check-out

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (user_id, work_date)                           -- กัน duplicate check-in
);
create index idx_attendance_user_date on attendance_records(user_id, work_date desc);
create index idx_attendance_team_date on attendance_records(team_id, work_date desc);
create index idx_attendance_status on attendance_records(status);
create trigger trg_attendance_updated before update on attendance_records
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- PRESENCE CHECKS  (สุ่มยืนยันระหว่างวัน)
-- ---------------------------------------------------------------------------
create table presence_checks (
  id                uuid primary key default gen_random_uuid(),
  attendance_id     uuid not null references attendance_records(id) on delete cascade,
  user_id           uuid not null references users(id) on delete cascade,
  scheduled_at      timestamptz not null,               -- เวลาที่ระบบสุ่มขึ้น
  respond_by        timestamptz not null,               -- ต้องตอบภายในเวลานี้
  acknowledged_at   timestamptz,
  status            presence_status not null default 'pending',
  ack_lat           double precision,
  ack_lng           double precision,
  ack_ip            inet,
  ack_device_id     uuid references registered_devices(id),
  ack_selfie_path   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_presence_user on presence_checks(user_id);
create index idx_presence_attendance on presence_checks(attendance_id);
create index idx_presence_status on presence_checks(status);
create trigger trg_presence_updated before update on presence_checks
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- WORK LOGS  (บันทึกงานระหว่างวัน)
-- ---------------------------------------------------------------------------
create table work_logs (
  id            uuid primary key default gen_random_uuid(),
  attendance_id uuid references attendance_records(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  title         text not null,
  detail        text,
  status        work_log_status not null default 'planned',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index idx_worklogs_user on work_logs(user_id);
create index idx_worklogs_attendance on work_logs(attendance_id);
create trigger trg_worklogs_updated before update on work_logs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- ADJUSTMENT REQUESTS  (คำขอแก้ไขเวลา — ห้ามแก้ attendance ตรง)
-- ---------------------------------------------------------------------------
create table adjustment_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  attendance_id   uuid references attendance_records(id) on delete set null,
  target_date     date not null,
  requested_check_in  timestamptz,
  requested_check_out timestamptz,
  reason          text not null,
  evidence_path   text,                                 -- หลักฐานแนบ (private)
  status          adjustment_status not null default 'pending',
  reviewed_by     uuid references users(id),
  reviewed_at     timestamptz,
  admin_note      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index idx_adjustments_user on adjustment_requests(user_id);
create index idx_adjustments_status on adjustment_requests(status);
create trigger trg_adjustments_updated before update on adjustment_requests
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- AUDIT LOGS  (insert-only จากฝั่งเว็บ — ดู RLS)
-- ---------------------------------------------------------------------------
create table audit_logs (
  id            bigint generated always as identity primary key,
  actor_id      uuid references users(id),              -- ใครทำ (null = ระบบ)
  actor_email   text,
  action        text not null,                          -- 'check_in', 'login', ...
  entity_type   text,                                   -- 'attendance', 'device', ...
  entity_id     text,
  metadata      jsonb not null default '{}',
  ip            inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index idx_audit_actor on audit_logs(actor_id);
create index idx_audit_action on audit_logs(action);
create index idx_audit_created on audit_logs(created_at desc);

-- LOGIN HISTORY  (ข้อ 1)
create table login_history (
  id          bigint generated always as identity primary key,
  user_id     uuid references users(id) on delete cascade,
  email       text,
  ip          inet,
  user_agent  text,
  device_fingerprint text,
  success     boolean not null default true,
  reason      text,                                     -- เช่น 'not_whitelisted'
  created_at  timestamptz not null default now()
);
create index idx_login_history_user on login_history(user_id);

-- ---------------------------------------------------------------------------
-- APP SETTINGS  (ตั้งค่าระดับบริษัท — key/value)
-- ---------------------------------------------------------------------------
create table app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_app_settings_updated before update on app_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS  (แจ้งเตือนในเว็บ)
-- ---------------------------------------------------------------------------
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  type        text not null,                            -- 'presence_check', 'device_approved', ...
  title       text not null,
  body        text,
  data        jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, read_at);
