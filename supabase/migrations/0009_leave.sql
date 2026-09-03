-- =============================================================================
-- ระบบลางาน: พนักงานยื่นคำขอลา (รายวัน) → แอดมินอนุมัติจึงลาสำเร็จ
-- กติกา (ตั้งได้ที่ app_settings):
--   min_leave_advance_days = ต้องยื่นล่วงหน้าอย่างน้อยกี่วัน
--   max_leaves_per_month   = ลาได้กี่ครั้งต่อเดือน
--   max_concurrent_leaves  = อนุมัติลาวันเดียวกันได้กี่คน
-- idempotent: รันซ้ำได้
-- =============================================================================

create table if not exists leave_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  leave_date  date not null,
  reason      text,
  status      adjustment_status not null default 'pending',  -- pending / approved / rejected
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists idx_leave_user on leave_requests(user_id);
create index if not exists idx_leave_date on leave_requests(leave_date);
-- กันยื่นวันเดิมซ้ำ (เฉพาะคำขอที่ยังไม่ถูกยกเลิก)
create unique index if not exists uniq_leave_user_date
  on leave_requests(user_id, leave_date) where deleted_at is null;

drop trigger if exists trg_leave_updated on leave_requests;
create trigger trg_leave_updated before update on leave_requests
  for each row execute function set_updated_at();

alter table leave_requests enable row level security;
drop policy if exists leave_select on leave_requests;
create policy leave_select on leave_requests for select using (can_view_user(user_id));
drop policy if exists leave_insert_self on leave_requests;
create policy leave_insert_self on leave_requests for insert with check (user_id = auth.uid());
-- อนุมัติ/ยกเลิก ทำผ่าน service role ฝั่ง server เท่านั้น

-- ค่าตั้งต้นของกติกาการลา (ชื่อ key ตรงกับ lib/settings.ts)
insert into app_settings (key, value, description) values
  ('min_leave_advance_days', '3'::jsonb, 'ต้องยื่นลาล่วงหน้าอย่างน้อยกี่วัน'),
  ('max_leaves_per_month',   '4'::jsonb, 'ลาได้สูงสุดกี่ครั้งต่อเดือน'),
  ('max_concurrent_leaves',  '2'::jsonb, 'อนุมัติลาวันเดียวกันได้สูงสุดกี่คน')
on conflict (key) do nothing;
