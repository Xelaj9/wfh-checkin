import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { timeInTz } from '@/lib/utils'
import { getEvidenceSignedUrl } from '@/lib/evidence'
import { StatusBadge } from '@/components/ui/status-badge'
import { LocationMap, type MapPoint } from '@/components/admin/location-map'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

// รายการ attendance ที่ผิดปกติ/รอตรวจสอบ พร้อมเหตุผล (risk_factors)
export default async function SuspiciousPage() {
  await requireRole(['admin', 'super_admin'])
  const supabase = createClient()

  const { data: records } = await supabase
    .from('attendance_records')
    .select('*, users!attendance_records_user_id_fkey(full_name, email)')
    .in('status', ['suspicious', 'pending_review'])
    .order('work_date', { ascending: false })
    .limit(100)

  // รายการที่ไม่ตอบ presence check (missed)
  const { data: missed } = await supabase
    .from('presence_checks')
    .select('id, scheduled_at, users!presence_checks_user_id_fkey(full_name, email)')
    .eq('status', 'missed')
    .order('scheduled_at', { ascending: false })
    .limit(50)

  // signed URL ของ selfie สำหรับตรวจด้วยคน (req 6)
  const withSelfie = await Promise.all(
    (records ?? []).map(async (r) => ({
      ...r,
      selfieUrl: r.check_in_selfie_path
        ? await getEvidenceSignedUrl(r.check_in_selfie_path, 120)
        : null,
    }))
  )

  // พิกัดเช็คอินของรายการที่มีตำแหน่ง → แสดงบนแผนที่ (ดูคร่าว ๆ)
  const points: MapPoint[] = withSelfie
    .filter((r) => r.check_in_lat != null && r.check_in_lng != null)
    .map((r) => {
      const u = (r as { users?: { full_name?: string; email?: string } }).users
      return {
        lat: r.check_in_lat as number,
        lng: r.check_in_lng as number,
        label: `${u?.full_name ?? u?.email ?? '-'} · ${r.work_date}`,
        accuracy: r.check_in_accuracy,
        status: r.status as MapPoint['status'],
      }
    })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">รายการพฤติกรรมผิดปกติ</h1>

      {points.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-slate-500">
            พิกัดเช็คอิน ({points.length} จุด) — สีตามสถานะความเสี่ยง
          </p>
          <LocationMap points={points} />
        </div>
      )}
      {(!records || records.length === 0) && (
        <p className="rounded-xl border border-dashed bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-400">
          ไม่มีรายการผิดปกติ 🎉
        </p>
      )}
      <div className="space-y-3">
        {withSelfie.map((r) => {
          const u = (r as { users?: { full_name?: string; email?: string } }).users
          const factors = Array.isArray(r.risk_factors) ? r.risk_factors : []
          return (
            <div key={r.id} className="rounded-xl border bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Link href={`/admin/attendance/${r.id}`} className="font-medium hover:underline">
                    {u?.full_name ?? u?.email}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {r.work_date} · เข้า{' '}
                    {r.check_in_time ? timeInTz(DEFAULT_TZ, r.check_in_time) : '-'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-red-600">risk {r.risk_score}</span>
                  <StatusBadge status={r.status} />
                </div>
              </div>
              {r.selfieUrl && (
                <a
                  href={r.selfieUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-blue-600 underline"
                >
                  ดูรูปยืนยันตัวตน (selfie)
                </a>
              )}
              {factors.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {(factors as { label: string }[]).map((f, i) => (
                    <li key={i} className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                      {f.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <h2 className="pt-4 text-lg font-bold">ไม่ตอบ Presence Check (Missed)</h2>
      {(!missed || missed.length === 0) && (
        <p className="rounded-xl border border-dashed bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-400">
          ไม่มีรายการ
        </p>
      )}
      <div className="overflow-hidden rounded-xl border bg-white dark:bg-slate-900">
        {missed && missed.length > 0 && (
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {missed.map((m) => {
                const u = (m as { users?: { full_name?: string; email?: string } }).users
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-2 font-medium">{u?.full_name ?? u?.email}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(m.scheduled_at).toLocaleString('th-TH')}
                    </td>
                    <td className="px-4 py-2">
                      <span className="badge badge-suspicious">ไม่ตอบ</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
