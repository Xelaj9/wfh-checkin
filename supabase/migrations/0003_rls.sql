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
