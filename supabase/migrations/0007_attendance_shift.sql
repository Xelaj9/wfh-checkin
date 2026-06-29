-- เก็บ "กะที่พนักงานเลือกตอนเช็คอิน" รายวัน (รองรับการวนกะ)
-- idempotent
alter table attendance_records add column if not exists shift_id uuid references shifts(id) on delete set null;
create index if not exists idx_attendance_shift on attendance_records(shift_id);
