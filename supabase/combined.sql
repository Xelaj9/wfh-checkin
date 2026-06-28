-- ============================================================
-- WFH Check-in — COMBINED SQL (paste ลงใน Supabase SQL Editor)
-- รวม: 0001_schema + 0002_functions + 0003_rls + 0004_storage + seed
-- ============================================================

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
  work_start  time not null default '09:00',          -- ใช้คำนวณ "มาสาย"
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

-- =============================================================================
-- Helper functions สำหรับ RLS + business logic
-- ฟังก์ชันเช็ค role ต้องเป็น SECURITY DEFINER เพื่อกัน RLS recursion บนตาราง users
-- =============================================================================

-- role ของผู้ใช้ปัจจุบัน (อ่านจาก users โดย bypass RLS)
create or replace function current_user_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid() and is_active = true;
$$;

-- team ของผู้ใช้ปัจจุบัน
create or replace function current_user_team()
returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from public.users where id = auth.uid();
$$;

create or replace function is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_user_role() = 'super_admin', false);
$$;

-- admin หรือ super_admin
create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_user_role() in ('admin', 'super_admin'), false);
$$;

-- ผู้ใช้ปัจจุบันมีสิทธิ์ดูข้อมูลของ target_user หรือไม่
-- (ตัวเอง / super_admin เห็นหมด / admin เห็นเฉพาะทีมตัวเอง)
create or replace function can_view_user(target_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    target_user = auth.uid()
    or is_super_admin()
    or (
      is_admin()
      and (select team_id from public.users where id = target_user) = current_user_team()
    );
$$;

-- ---------------------------------------------------------------------------
-- เมื่อมี user ใหม่ใน auth.users → สร้าง row ใน public.users *เฉพาะ* ถ้าอยู่ใน whitelist
-- ถ้าไม่อยู่ whitelist จะไม่สร้าง row (และ callback ฝั่งแอปจะ sign out + log)
-- ---------------------------------------------------------------------------
create or replace function handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wl public.allowed_emails%rowtype;
begin
  select * into wl from public.allowed_emails
    where lower(email) = lower(new.email) and deleted_at is null
    limit 1;

  if not found then
    -- ไม่อยู่ใน whitelist → ไม่สร้าง profile (แอปจะปฏิเสธ)
    return new;
  end if;

  insert into public.users (id, email, full_name, avatar_url, role, team_id, created_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', wl.full_name),
    new.raw_user_meta_data->>'avatar_url',
    wl.role,
    wl.team_id,
    wl.created_by
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.users.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url);

  -- สร้าง employee_profile ให้อัตโนมัติ
  insert into public.employee_profiles (user_id, created_by)
  values (new.id, wl.created_by)
  on conflict (user_id) do nothing;

  update public.allowed_emails set used_at = now() where id = wl.id;

  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- ป้องกัน UPDATE/DELETE บน audit_logs (append-only แม้ใช้ service role ก็ยังถูกบล็อก)
-- ---------------------------------------------------------------------------
create or replace function prevent_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs เป็น append-only ห้ามแก้ไขหรือลบ';
end;
$$;
create trigger trg_audit_no_update before update on audit_logs
  for each row execute function prevent_mutation();
create trigger trg_audit_no_delete before delete on audit_logs
  for each row execute function prevent_mutation();

-- =============================================================================
-- Row Level Security (RLS)
-- หลักการ:
--   - เปิด RLS ทุกตาราง (deny by default)
--   - employee อ่าน/เขียนได้เฉพาะข้อมูลของตัวเอง
--   - admin อ่านได้เฉพาะทีมตัวเอง / super_admin เห็นทั้งหมด
--   - การ "เขียน attendance/audit/อนุมัติ" ทำผ่าน service-role ฝั่ง server
--     (service role bypass RLS โดยธรรมชาติ — เราจึงไม่เปิด INSERT policy ให้ client)
-- =============================================================================

alter table teams                enable row level security;
alter table users                enable row level security;
alter table allowed_emails        enable row level security;
alter table employee_profiles     enable row level security;
alter table work_locations        enable row level security;
alter table registered_devices    enable row level security;
alter table attendance_records    enable row level security;
alter table presence_checks       enable row level security;
alter table work_logs             enable row level security;
alter table adjustment_requests   enable row level security;
alter table audit_logs            enable row level security;
alter table login_history         enable row level security;
alter table app_settings          enable row level security;
alter table notifications         enable row level security;

-- ---------------------------------------------------------------------------
-- TEAMS
-- ---------------------------------------------------------------------------
create policy teams_select on teams for select using (
  is_super_admin() or id = current_user_team()
);
create policy teams_write on teams for all using (is_super_admin()) with check (is_super_admin());

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
create policy users_select on users for select using (can_view_user(id));
-- ผู้ใช้แก้ได้เฉพาะ field ของตัวเอง (ผ่าน server action เท่านั้นในทางปฏิบัติ)
create policy users_update_self on users for update using (id = auth.uid()) with check (id = auth.uid());
-- super_admin จัดการได้ทุกคน
create policy users_admin_all on users for all using (is_super_admin()) with check (is_super_admin());

-- ---------------------------------------------------------------------------
-- ALLOWED EMAILS (whitelist) — เฉพาะ admin
-- ---------------------------------------------------------------------------
create policy allowed_emails_admin on allowed_emails for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- EMPLOYEE PROFILES
-- ---------------------------------------------------------------------------
create policy profiles_select on employee_profiles for select using (can_view_user(user_id));
create policy profiles_update_self on employee_profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profiles_admin on employee_profiles for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- WORK LOCATIONS — พนักงานดูของตัวเองได้ / แอดมินจัดการ
-- ---------------------------------------------------------------------------
create policy locations_select on work_locations for select using (can_view_user(user_id));
create policy locations_admin on work_locations for all
  using (is_admin() and can_view_user(user_id))
  with check (is_admin() and can_view_user(user_id));

-- ---------------------------------------------------------------------------
-- REGISTERED DEVICES — พนักงานดูของตัวเอง / อนุมัติโดย admin (ผ่าน server)
-- ---------------------------------------------------------------------------
create policy devices_select on registered_devices for select using (can_view_user(user_id));
create policy devices_admin on registered_devices for all
  using (is_admin() and can_view_user(user_id))
  with check (is_admin() and can_view_user(user_id));

-- ---------------------------------------------------------------------------
-- ATTENDANCE — อ่านอย่างเดียวจาก client; การเขียนทำผ่าน service role
-- ---------------------------------------------------------------------------
create policy attendance_select on attendance_records for select using (can_view_user(user_id));

-- ---------------------------------------------------------------------------
-- PRESENCE CHECKS
-- ---------------------------------------------------------------------------
create policy presence_select on presence_checks for select using (can_view_user(user_id));

-- ---------------------------------------------------------------------------
-- WORK LOGS — พนักงานจัดการของตัวเองได้
-- ---------------------------------------------------------------------------
create policy worklogs_select on work_logs for select using (can_view_user(user_id));
create policy worklogs_insert_self on work_logs for insert with check (user_id = auth.uid());
create policy worklogs_update_self on work_logs for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ADJUSTMENT REQUESTS — พนักงานสร้าง/ดูของตัวเอง; อนุมัติผ่าน server (admin)
-- ---------------------------------------------------------------------------
create policy adjustments_select on adjustment_requests for select using (can_view_user(user_id));
create policy adjustments_insert_self on adjustment_requests for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- AUDIT LOGS — อ่านได้เฉพาะ admin; ห้าม insert/update/delete จาก client
-- (เขียนผ่าน service role; update/delete ถูกบล็อกด้วย trigger ใน 0002)
-- ---------------------------------------------------------------------------
create policy audit_select_admin on audit_logs for select using (is_admin());

-- ---------------------------------------------------------------------------
-- LOGIN HISTORY — admin ดูได้ / ผู้ใช้ดูของตัวเอง
-- ---------------------------------------------------------------------------
create policy login_history_select on login_history for select
  using (user_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- APP SETTINGS — ทุกคนอ่าน setting ที่ public ได้ผ่าน server; เขียนเฉพาะ super_admin
-- ---------------------------------------------------------------------------
create policy settings_select on app_settings for select using (is_admin());
create policy settings_write on app_settings for all
  using (is_super_admin()) with check (is_super_admin());

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS — ของตัวเองเท่านั้น
-- ---------------------------------------------------------------------------
create policy notifications_select on notifications for select using (user_id = auth.uid());
create policy notifications_update_self on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- Storage: private bucket สำหรับ selfie / หลักฐาน
-- โครงสร้าง path: <user_id>/<...>  → ใช้ folder แรกเป็น owner check
-- การดูรูปทำผ่าน signed URL ที่ออกโดย server เท่านั้น (ข้อ 16)
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- พนักงานอัปโหลดได้เฉพาะใต้โฟลเดอร์ของตัวเอง (<user_id>/...)
create policy "evidence_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- เจ้าของอ่านไฟล์ตัวเองได้ / admin อ่านได้ตามขอบเขตทีม
create policy "evidence_select_scoped"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_view_user(((storage.foldername(name))[1])::uuid)
    )
  );

-- ไม่อนุญาต update/delete จาก client (ลบตาม retention policy ทำฝั่ง server)

-- ===== SEED =====
-- =============================================================================
-- Seed data (ตัวอย่าง) — รันด้วย `supabase db reset`
-- ลำดับสำคัญ: ใส่ allowed_emails ก่อน แล้วค่อยสร้าง auth.users
-- เพื่อให้ trigger handle_new_auth_user สร้าง public.users + profile อัตโนมัติ
-- =============================================================================

-- ---- Teams ----
insert into teams (id, name, timezone, work_start, late_grace_minutes) values
  ('11111111-1111-1111-1111-111111111111', 'ทีม Admin Support', 'Asia/Bangkok', '09:00', 15),
  ('22222222-2222-2222-2222-222222222222', 'ทีม Operations',    'Asia/Bangkok', '08:30', 10);

-- ---- App settings (ค่าเริ่มต้นบริษัท) ----
insert into app_settings (key, value, description) values
  ('selfie_required', 'false'::jsonb, 'บังคับถ่าย selfie ตอนเช็คอินหรือไม่'),
  ('block_checkin_without_location', 'false'::jsonb, 'ถ้า true: ปิด location = เช็คอินไม่ได้; false = pending_review'),
  ('presence_checks_per_day', '2'::jsonb, 'จำนวน random presence check ต่อวัน'),
  ('presence_response_minutes', '10'::jsonb, 'เวลาให้ตอบ presence check (นาที)'),
  ('default_geofence_radius', '200'::jsonb, 'รัศมี geofence เริ่มต้น (เมตร)'),
  ('data_retention_days', '365'::jsonb, 'ระยะเวลาเก็บข้อมูล (วัน)');

-- ---- Whitelist (อีเมลที่อนุญาต) ----
-- ⚠️ เปลี่ยนอีเมลเหล่านี้เป็นอีเมล Google จริงของคุณเพื่อทดสอบ login
insert into allowed_emails (email, role, team_id, full_name) values
  ('superadmin@example.com', 'super_admin', '11111111-1111-1111-1111-111111111111', 'Super Admin'),
  ('manager@example.com',    'admin',       '11111111-1111-1111-1111-111111111111', 'ผู้จัดการทีม A'),
  ('emp1@example.com',       'employee',    '11111111-1111-1111-1111-111111111111', 'พนักงาน หนึ่ง'),
  ('emp2@example.com',       'employee',    '22222222-2222-2222-2222-222222222222', 'พนักงาน สอง');

-- ---- Demo auth users (สำหรับทดสอบ local โดยไม่ต้องผ่าน Google จริง) ----
-- trigger จะสร้าง row ใน public.users + employee_profiles ให้อัตโนมัติ
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'superadmin@example.com', crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Super Admin"}', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@example.com',    crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"ผู้จัดการทีม A"}', now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp1@example.com',       crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"พนักงาน หนึ่ง"}', now(), now()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'emp2@example.com',       crypt('Password123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"พนักงาน สอง"}', now(), now());

-- สำคัญ: เวลา insert เข้า auth.users เอง คอลัมน์ token ต้องเป็น '' (ไม่ใช่ NULL)
-- ไม่งั้น GoTrue (auth ของ Supabase) จะ login ไม่ผ่าน
update auth.users set
  confirmation_token        = '',
  recovery_token            = '',
  email_change_token_new    = '',
  email_change_token_current= '',
  email_change              = '',
  phone_change              = '',
  phone_change_token        = '',
  reauthentication_token    = ''
where email like '%@example.com';

-- ---- Work locations ตัวอย่าง (กรุงเทพฯ) ----
insert into work_locations (user_id, label, latitude, longitude, radius_meters) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'บ้าน (สาทร)', 13.7211, 100.5300, 200),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'คอนโด (ลาดพร้าว)', 13.8000, 100.5800, 250);

-- ---- Registered device ที่อนุมัติแล้วของ emp1 (ตัวอย่าง) ----
insert into registered_devices (user_id, fingerprint, label, browser, os, screen, timezone, status, approved_at)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'demo-fingerprint-emp1', 'iPhone ของหนึ่ง', 'Safari', 'iOS', '390x844', 'Asia/Bangkok', 'approved', now());

-- หมายเหตุ: attendance ตัวอย่างสร้างผ่านการเช็คอินจริงในแอป
-- เพื่อให้ risk scoring / audit log ทำงานครบ flow
