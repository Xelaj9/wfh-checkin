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

-- ---- Work locations ตัวอย่าง (กรุงเทพฯ) ----
insert into work_locations (user_id, label, latitude, longitude, radius_meters) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'บ้าน (สาทร)', 13.7211, 100.5300, 200),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'คอนโด (ลาดพร้าว)', 13.8000, 100.5800, 250);

-- ---- Registered device ที่อนุมัติแล้วของ emp1 (ตัวอย่าง) ----
insert into registered_devices (user_id, fingerprint, label, browser, os, screen, timezone, status, approved_at)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'demo-fingerprint-emp1', 'iPhone ของหนึ่ง', 'Safari', 'iOS', '390x844', 'Asia/Bangkok', 'approved', now());

-- หมายเหตุ: attendance ตัวอย่างสร้างผ่านการเช็คอินจริงในแอป
-- เพื่อให้ risk scoring / audit log ทำงานครบ flow
