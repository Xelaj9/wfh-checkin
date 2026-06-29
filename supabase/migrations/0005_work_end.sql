-- เพิ่มเวลาเลิกงานของกะ (ทีม) — ใช้คู่กับ work_start ที่มีอยู่
-- idempotent: รันซ้ำได้
alter table teams add column if not exists work_end time not null default '18:00';
