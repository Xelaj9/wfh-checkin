-- =============================================================================
-- ระบบหลายกะ (shifts) — บริษัทตั้งได้หลายกะ (เช่น เช้า/บ่าย/ดึก) แล้ว assign พนักงาน
-- คำนวณ "มาสาย" อิงกะของพนักงานแต่ละคน (fallback ไปที่ teams.work_start ถ้าไม่ได้กำหนดกะ)
-- idempotent: รันซ้ำได้
-- =============================================================================

create table if not exists shifts (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,                 -- เช่น "กะเช้า"
  start_time         time not null,                 -- เวลาเข้า
  end_time           time not null,                 -- เวลาเลิก
  late_grace_minutes int  not null default 15,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references users(id),
  deleted_at         timestamptz
);

-- assign กะให้พนักงาน (อยู่บน users เพื่อ join ง่ายตอน check-in)
alter table users add column if not exists shift_id uuid references shifts(id) on delete set null;

create index if not exists idx_users_shift on users(shift_id);

-- trigger updated_at (ใช้ฟังก์ชัน set_updated_at ที่มีอยู่)
drop trigger if exists trg_shifts_updated on shifts;
create trigger trg_shifts_updated before update on shifts
  for each row execute function set_updated_at();

-- ---- RLS ----
alter table shifts enable row level security;

drop policy if exists shifts_select on shifts;
create policy shifts_select on shifts for select using (auth.uid() is not null);

drop policy if exists shifts_write on shifts;
create policy shifts_write on shifts for all
  using (is_admin()) with check (is_admin());

-- ---- กะตัวอย่าง (เพิ่มถ้ายังไม่มี) ----
insert into shifts (name, start_time, end_time, late_grace_minutes)
select * from (values
  ('กะเช้า',  time '08:00', time '17:00', 15),
  ('กะบ่าย',  time '13:00', time '22:00', 15),
  ('กะดึก',   time '22:00', time '06:00', 15)
) as v(name, start_time, end_time, late_grace_minutes)
where not exists (select 1 from shifts);
