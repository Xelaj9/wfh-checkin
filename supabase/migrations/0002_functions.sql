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
