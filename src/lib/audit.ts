import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/** action สำคัญที่ต้องบันทึก audit log (ข้อ 15) */
export type AuditAction =
  | 'login'
  | 'failed_login'
  | 'check_in'
  | 'check_out'
  | 'failed_check_in'
  | 'location_denied'
  | 'new_device_detected'
  | 'device_approved'
  | 'device_rejected'
  | 'setting_updated'
  | 'adjustment_requested'
  | 'adjustment_approved'
  | 'adjustment_rejected'
  | 'presence_acknowledged'
  | 'presence_missed'
  | 'report_exported'

interface WriteAuditArgs {
  action: AuditAction
  actorId?: string | null
  actorEmail?: string | null
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
}

/** ดึง client IP จาก request headers (รองรับ Vercel proxy) */
export function getClientIp(): string | null {
  const h = headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip')
}

/**
 * เขียน audit log ผ่าน service role (client เขียนเองไม่ได้ — ดู RLS)
 * audit_logs เป็น append-only: update/delete ถูกบล็อกด้วย trigger
 */
export async function writeAudit(args: WriteAuditArgs): Promise<void> {
  const admin = createAdminClient()
  const h = headers()
  await admin.from('audit_logs').insert({
    action: args.action,
    actor_id: args.actorId ?? null,
    actor_email: args.actorEmail ?? null,
    entity_type: args.entityType ?? null,
    entity_id: args.entityId ?? null,
    metadata: (args.metadata ?? {}) as never,
    ip: getClientIp(),
    user_agent: h.get('user-agent'),
  } as never)
}
