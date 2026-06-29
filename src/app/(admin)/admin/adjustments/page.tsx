import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getEvidenceSignedUrl } from '@/lib/evidence'
import { AdjustmentDecision } from '@/components/admin/adjustment-decision'

export default async function AdminAdjustmentsPage() {
  await requireRole(['admin', 'super_admin'])
  const supabase = createClient()

  // RLS จำกัดขอบเขตทีมให้แล้ว
  const { data: requests } = await supabase
    .from('adjustment_requests')
    .select('*, users(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(50)

  // ออก signed URL ให้หลักฐาน (ดูได้เฉพาะแอดมินที่มีสิทธิ์)
  const withEvidence = await Promise.all(
    (requests ?? []).map(async (r) => ({
      ...r,
      evidenceUrl: r.evidence_path ? await getEvidenceSignedUrl(r.evidence_path, 120) : null,
    }))
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">คำขอแก้ไขเวลา</h1>

      {withEvidence.length === 0 && (
        <p className="rounded-xl border border-dashed bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-400">
          ไม่มีคำขอ
        </p>
      )}

      <div className="space-y-3">
        {withEvidence.map((r) => {
          const u = (r as { users?: { full_name?: string; email?: string } }).users
          return (
            <div key={r.id} className="rounded-xl border bg-white dark:bg-slate-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{u?.full_name ?? u?.email}</p>
                  <p className="text-xs text-slate-400">วันที่ {r.target_date}</p>
                </div>
                <span
                  className={`badge ${
                    r.status === 'approved'
                      ? 'badge-normal'
                      : r.status === 'rejected'
                        ? 'badge-suspicious'
                        : 'badge-pending'
                  }`}
                >
                  {r.status}
                </span>
              </div>

              <dl className="mt-2 grid grid-cols-2 gap-1 text-sm text-slate-600">
                <div>ขอเวลาเข้า: {r.requested_check_in ?? '-'}</div>
                <div>ขอเวลาออก: {r.requested_check_out ?? '-'}</div>
              </dl>
              <p className="mt-1 text-sm">เหตุผล: {r.reason}</p>
              {r.evidenceUrl && (
                <a
                  href={r.evidenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm text-blue-600 underline"
                >
                  ดูหลักฐานแนบ
                </a>
              )}

              {r.status === 'pending' && (
                <div className="mt-3">
                  <AdjustmentDecision id={r.id} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
