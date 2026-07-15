-- รองรับเช็คอินหลายรอบต่อวัน (ตั้งเพดานได้ที่ app_settings.max_checkins_per_day)
-- 1 รอบ = 1 แถวใน attendance_records — เลิกบังคับ unique (user, วัน)
-- idempotent
alter table attendance_records drop constraint if exists attendance_records_user_id_work_date_key;
create index if not exists idx_attendance_user_date_multi on attendance_records(user_id, work_date, check_in_time);

insert into app_settings (key, value, description)
values ('max_checkins_per_day', '1'::jsonb, 'จำนวนรอบเช็คอินสูงสุดต่อวัน (1 = แบบเดิม)')
on conflict (key) do nothing;
