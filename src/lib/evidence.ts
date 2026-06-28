import { createAdminClient } from '@/lib/supabase/admin'

/**
 * ออก signed URL สำหรับดูไฟล์ใน private bucket "evidence"
 * เรียกฝั่ง server เท่านั้น และต้องตรวจสิทธิ์ผู้เรียกก่อน (ดู caller)
 */
export async function getEvidenceSignedUrl(
  path: string,
  expiresInSeconds = 60
): Promise<string | null> {
  if (!path) return null
  const admin = createAdminClient()
  const { data } = await admin.storage.from('evidence').createSignedUrl(path, expiresInSeconds)
  return data?.signedUrl ?? null
}
