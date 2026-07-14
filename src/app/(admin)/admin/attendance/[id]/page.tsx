import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEvidenceSignedUrl } from '@/lib/evidence'
import { timeInTz, formatMinutes } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import { LocationMap, type MapPoint } from '@/components/admin/location-map'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

interface Factor {
  code: string
  label: string
  weight: number
}

// หน้าหลักฐานรายตัว — "ทำไมถึงโดน flag" สำหรับแอดมินตรวจด้วยคน
export default async function AttendanceDetailPage({ params }: { params: { id: string } }) {
  await requireRole(['admin', 'super_admin'])
  const supabase = createClient()

  // RLS จำกัดให้เห็นเฉพาะทีมตัวเอง — เห็น = มีสิทธิ์
  const { data: rec } = await supabase
    .from('attendance_records')
    .select('*, users!attendance_records_user_id_fkey(full_name, email), shifts(name, start_time, end_time)')
    .eq('id', params.id)
    .maybeSingle()
  if (!rec) notFound()
  const shiftInfo = (rec as { shifts?: { name?: string; start_time?: string; end_time?: string } }).shifts

  const u = (rec as { users?: { full_name?: string; email?: string } }).users
  const factors = (Array.isArray(rec.risk_factors) ? rec.risk_factors : []) as Factor[]

  // ข้อมูลเสริม (อ่านผ่าน service role ในขอบเขตที่ตรวจสิทธิ์แล้ว)
  const admin = createAdminClient()
  const [{ data: device }, { data: presence }, { data: audit }, selfieUrl] = await Promise.all([
    rec.check_in_device_id
      ? admin.from('registered_devices').select('*').eq('id', rec.check_in_device_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('presence_checks').select('*').eq('attendance_id', rec.id).order('scheduled_at'),
    admin
      .from('audit_logs')
      .select('action, created_at, metadata, ip')
      .eq('actor_id', rec.user_id)
      .order('created_at', { ascending: false })
      .limit(12),
    rec.check_in_selfie_path ? getEvidenceSignedUrl(rec.check_in_selfie_path, 120) : Promise.resolve(null),
  ])

  const points: MapPoint[] = []
  if (rec.check_in_lat != null && rec.check_in_lng != null)
    points.push({ lat: rec.check_in_lat, lng: rec.check_in_lng, label: 'เช็คอิน', accuracy: rec.check_in_accuracy, status: rec.status as MapPoint['status'] })
  if (rec.check_out_lat != null && rec.check_out_lng != null)
    points.push({ lat: rec.check_out_lat, lng: rec.check_out_lng, label: 'เช็คเอาต์', accuracy: rec.check_out_accuracy, status: 'normal' })

  return (
    <div className="space-y-5">
      <Link href="/admin/suspicious" className="text-sm text-slate-500 hover:text-slate-900">
        ← กลับ
      </Link>

      {/* หัว */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white dark:bg-slate-900 p-4">
        <div>
          <h1 className="text-lg font-bold">{u?.full_name ?? u?.email}</h1>
          <p className="text-sm text-slate-400">{rec.work_date}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold text-red-600">{rec.risk_score}</p>
            <p className="text-xs text-slate-400">risk score</p>
          </div>
          <StatusBadge status={rec.status} />
        </div>
      </div>

      {/* ทำไมถึงโดน flag */}
      <section className="rounded-xl border bg-white dark:bg-slate-900 p-4">
        <h2 className="mb-3 font-semibold">เหตุผลที่ระบบ flag</h2>
        {factors.length === 0 ? (
          <p className="text-sm text-green-600">ไม่มีสัญญาณผิดปกติ (ปกติ)</p>
        ) : (
          <ul className="space-y-2">
            {factors.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm">
                <span className="text-red-800">{f.label}</span>
                <span className="font-mono text-red-600">+{f.weight}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* แผนที่ */}
      {points.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">พิกัด</h2>
          <LocationMap points={points} />
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* check-in */}
        <section className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-sm">
          <h2 className="mb-2 font-semibold">เช็คอิน</h2>
          <Row
            k="กะ"
            v={shiftInfo?.name ? `${shiftInfo.name} (${shiftInfo.start_time?.slice(0, 5)}–${shiftInfo.end_time?.slice(0, 5)})` : 'ตามเวลาทีม'}
          />
          <Row k="เวลา" v={rec.check_in_time ? timeInTz(DEFAULT_TZ, rec.check_in_time) : '-'} />
          <Row k="มาสาย" v={rec.is_late ? 'ใช่' : 'ไม่'} />
          <Row k="อยู่ในพื้นที่" v={rec.check_in_within_geofence == null ? '-' : rec.check_in_within_geofence ? 'ใช่' : 'ไม่ (นอกพื้นที่)'} danger={rec.check_in_within_geofence === false} />
          <Row k="ความแม่นยำ GPS" v={rec.check_in_accuracy != null ? `~${Math.round(rec.check_in_accuracy)} ม.` : '-'} danger={(rec.check_in_accuracy ?? 0) > 1000} />
          <Row k="IP" v={rec.check_in_ip ?? '-'} />
        </section>

        {/* device */}
        <section className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-sm">
          <h2 className="mb-2 font-semibold">อุปกรณ์</h2>
          {device ? (
            <>
              <Row k="เครื่อง" v={`${device.browser ?? '-'} · ${device.os ?? '-'}`} />
              <Row k="หน้าจอ" v={device.screen ?? '-'} />
              <Row k="สถานะอุปกรณ์" v={device.status} danger={device.status !== 'approved'} />
              <Row k="fingerprint" v={(device.fingerprint ?? '').slice(0, 16) + '…'} />
            </>
          ) : (
            <p className="text-slate-400">ไม่มีข้อมูลอุปกรณ์</p>
          )}
        </section>
      </div>

      {/* check-out + selfie */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-sm">
          <h2 className="mb-2 font-semibold">เช็คเอาต์ / งาน</h2>
          <Row k="เวลาเลิก" v={rec.check_out_time ? timeInTz(DEFAULT_TZ, rec.check_out_time) : '-'} />
          <Row k="เวลาทำงานรวม" v={formatMinutes(rec.worked_minutes ?? null)} />
          <Row k="มีสรุปงาน" v={rec.work_summary ? 'มี' : 'ไม่มี'} danger={!rec.work_summary && !!rec.check_out_time} />
          {rec.work_plan && <p className="mt-2 text-slate-500">แผนงาน: {rec.work_plan}</p>}
        </section>

        <section className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-sm">
          <h2 className="mb-2 font-semibold">รูปยืนยันตัวตน</h2>
          {selfieUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <a href={selfieUrl} target="_blank" rel="noreferrer">
              <img src={selfieUrl} alt="selfie" className="max-h-48 rounded-lg" />
            </a>
          ) : (
            <p className="text-slate-400">ไม่มีรูป (setfie ปิดอยู่ หรือไม่ได้ถ่าย)</p>
          )}
        </section>
      </div>

      {/* presence checks */}
      <section className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-sm">
        <h2 className="mb-2 font-semibold">Presence check ระหว่างวัน</h2>
        {!presence || presence.length === 0 ? (
          <p className="text-slate-400">ไม่มีการสุ่มตรวจ</p>
        ) : (
          <ul className="space-y-1">
            {presence.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{timeInTz(DEFAULT_TZ, p.scheduled_at)}</span>
                <span className={p.status === 'missed' ? 'text-red-600' : p.status === 'acknowledged' ? 'text-green-600' : 'text-slate-400'}>
                  {p.status === 'missed' ? 'ไม่ตอบ' : p.status === 'acknowledged' ? 'ยืนยันแล้ว' : 'รอ'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* audit trail */}
      <section className="rounded-xl border bg-white dark:bg-slate-900 p-4 text-sm">
        <h2 className="mb-2 font-semibold">ประวัติการกระทำ (audit log)</h2>
        <ul className="space-y-1">
          {(audit ?? []).map((a, i) => (
            <li key={i} className="flex justify-between border-b py-1 last:border-0">
              <span className="font-mono text-xs text-slate-600">{a.action}</span>
              <span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString('th-TH')}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Row({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-slate-400">{k}</span>
      <span className={danger ? 'font-medium text-red-600' : 'font-medium'}>{v}</span>
    </div>
  )
}
