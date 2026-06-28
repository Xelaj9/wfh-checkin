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
