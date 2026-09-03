/**
 * กราฟสถิติบนแดชบอร์ดแอดมิน — SVG ล้วน (server component, ไม่เพิ่ม JS bundle)
 * Palette ผ่าน CVD validator ทั้ง light/dark:
 *   light: #059669 (ปกติ/ตรงเวลา) · #f59e0b (สาย/รอตรวจ) · #e11d48 (ผิดปกติ)
 *   dark : #0d9488 · #d97706 · #e11d48
 * specs: แท่ง ≤24px มุมบน 4px ฐานตัด, gap 2px, เส้น 2px, จุด r4+วงพื้น 2px,
 *        grid hairline, ตัวหนังสือใช้สี text ไม่ใช้สีซีรีส์, มี legend เมื่อ ≥2 ซีรีส์
 */

export interface DailyPoint {
  date: string // YYYY-MM-DD
  onTime: number
  late: number
  avgInMin: number | null // นาทีของวัน (เวลาเข้าเฉลี่ย รอบแรก/คน)
}
export interface EmployeeHours {
  name: string
  minutes: number
  lateDays: number
}
export interface StatusCounts {
  normal: number
  pending: number
  suspicious: number
}

const C = {
  ok: 'fill-[#059669] dark:fill-[#0d9488]',
  okStroke: 'stroke-[#059669] dark:stroke-[#0d9488]',
  late: 'fill-[#f59e0b] dark:fill-[#d97706]',
  bad: 'fill-[#e11d48]',
  grid: 'stroke-slate-200 dark:stroke-slate-700',
  tick: 'fill-slate-500 dark:fill-slate-400',
  label: 'fill-slate-600 dark:fill-slate-300',
  ring: 'fill-white dark:fill-slate-900',
}

const thDay = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`

function niceMax(n: number): number {
  if (n <= 5) return Math.max(2, n)
  const pow = 10 ** Math.floor(Math.log10(n))
  for (const m of [1, 2, 5, 10]) if (n <= m * pow) return m * pow
  return n
}

function Legend({ items }: { items: { cls: string; label: string }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden>
            <rect width="10" height="10" rx="2" className={it.cls} />
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  )
}

/** กราฟแท่งซ้อน: คนมาทำงานต่อวัน (ตรงเวลา + สาย) */
export function AttendanceTrendChart({ daily }: { daily: DailyPoint[] }) {
  const W = 660
  const H = 190
  const padL = 26
  const padB = 20
  const padT = 8
  const plotW = W - padL - 6
  const plotH = H - padT - padB
  const maxV = niceMax(Math.max(1, ...daily.map((d) => d.onTime + d.late)))
  const band = plotW / daily.length
  const barW = Math.min(24, Math.max(4, band - 4))
  const y = (v: number) => padT + plotH - (v / maxV) * plotH
  const ticks = maxV <= 5 ? [0, maxV] : [0, maxV / 2, maxV]

  return (
    <div>
      <Legend
        items={[
          { cls: C.ok, label: 'ตรงเวลา' },
          { cls: C.late, label: 'สาย' },
        ]}
      />
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="จำนวนคนมาทำงานต่อวัน">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 4} y1={y(t)} y2={y(t)} strokeWidth="1" className={C.grid} />
            <text x={padL - 5} y={y(t) + 3.5} textAnchor="end" fontSize="10" className={C.tick}>
              {t}
            </text>
          </g>
        ))}
        {daily.map((d, i) => {
          const cx = padL + i * band + (band - barW) / 2
          const hOk = (d.onTime / maxV) * plotH
          const hLate = (d.late / maxV) * plotH
          const showTick = daily.length <= 10 || i % 5 === 0 || i === daily.length - 1
          return (
            <g key={d.date}>
              <title>{`${thDay(d.date)} · มาทำงาน ${d.onTime + d.late} คน (ตรงเวลา ${d.onTime}, สาย ${d.late})`}</title>
              {d.onTime > 0 && (
                <path
                  className={C.ok}
                  d={
                    hLate > 0
                      ? `M${cx},${y(0)} v${-hOk} h${barW} v${hOk} z`
                      : roundedTop(cx, y(0), barW, hOk)
                  }
                />
              )}
              {d.late > 0 && <path className={C.late} d={roundedTop(cx, y(d.onTime) - 2, barW, hLate - (d.onTime > 0 ? 2 : 0))} />}
              {showTick && (
                <text x={cx + barW / 2} y={H - 6} textAnchor="middle" fontSize="9.5" className={C.tick}>
                  {thDay(d.date)}
                </text>
              )}
              {/* hit area สำหรับ hover tooltip เต็มคอลัมน์ */}
              <rect x={padL + i * band} y={padT} width={band} height={plotH} fill="transparent" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** path แท่งมุมบนโค้ง 4px ฐานตัด (data-end rounded, baseline square) */
function roundedTop(x: number, yBase: number, w: number, h: number): string {
  const hh = Math.max(0, h)
  const r = Math.min(4, hh, w / 2)
  return `M${x},${yBase} v${-(hh - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${hh - r} z`
}

/** กราฟเส้น: เวลาเข้าเฉลี่ยต่อวัน */
export function AvgCheckInChart({ daily }: { daily: DailyPoint[] }) {
  const pts = daily.filter((d) => d.avgInMin != null)
  if (pts.length === 0)
    return <p className="py-6 text-center text-sm text-slate-400">ยังไม่มีข้อมูลเวลาเข้า</p>

  const W = 660
  const H = 170
  const padL = 40
  const padB = 20
  const padT = 10
  const plotW = W - padL - 46
  const plotH = H - padT - padB
  const vals = pts.map((p) => p.avgInMin!)
  const lo = Math.floor(Math.min(...vals) / 60) * 60
  const hi = Math.ceil(Math.max(...vals) / 60) * 60 || 60
  const span = Math.max(60, hi - lo)
  const xi = (d: string) => daily.findIndex((x) => x.date === d)
  const x = (d: string) => padL + (xi(d) / Math.max(1, daily.length - 1)) * plotW
  const y = (v: number) => padT + plotH - ((v - lo) / span) * plotH
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.avgInMin!).toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const yTicks = [lo, lo + span / 2, lo + span]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="เวลาเข้างานเฉลี่ยต่อวัน">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - 40} y1={y(t)} y2={y(t)} strokeWidth="1" className={C.grid} />
          <text x={padL - 5} y={y(t) + 3.5} textAnchor="end" fontSize="10" className={C.tick}>
            {hhmm(t)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className={C.okStroke} />
      {pts.map((p) => (
        <g key={p.date}>
          <title>{`${thDay(p.date)} · เข้าเฉลี่ย ${hhmm(p.avgInMin!)}`}</title>
          <circle cx={x(p.date)} cy={y(p.avgInMin!)} r="6" className={C.ring} />
          <circle cx={x(p.date)} cy={y(p.avgInMin!)} r="4" className={C.ok} />
        </g>
      ))}
      <text x={x(last.date) + 9} y={y(last.avgInMin!) + 4} fontSize="11" fontWeight="600" className={C.label}>
        {hhmm(last.avgInMin!)}
      </text>
    </svg>
  )
}

/** แท่งแนวนอน: ชั่วโมงทำงานรวมต่อพนักงาน */
export function EmployeeHoursChart({ rows }: { rows: EmployeeHours[] }) {
  if (rows.length === 0)
    return <p className="py-6 text-center text-sm text-slate-400">ยังไม่มีข้อมูลชั่วโมงทำงาน</p>

  const W = 660
  const rowH = 30
  const padT = 4
  const H = padT + rows.length * rowH + 4
  const labelW = 130
  const valueW = 128 // เผื่อ "160.0 ชม. · สาย 3" ไม่ให้ทับแท่ง
  const plotW = W - labelW - valueW
  const maxV = Math.max(1, ...rows.map((r) => r.minutes))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="ชั่วโมงทำงานรวมต่อพนักงาน">
      {rows.map((r, i) => {
        const yTop = padT + i * rowH + 5
        const w = Math.max(3, (r.minutes / maxV) * plotW)
        const hrs = (r.minutes / 60).toFixed(1)
        const rr = Math.min(4, w / 2)
        return (
          <g key={r.name}>
            <title>{`${r.name} · ${hrs} ชม.${r.lateDays > 0 ? ` · สาย ${r.lateDays} วัน` : ''}`}</title>
            <text x={labelW - 8} y={yTop + 14} textAnchor="end" fontSize="11" className={C.label}>
              {r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name}
            </text>
            <path className={C.ok} d={`M${labelW},${yTop} h${w - rr} q${rr},0 ${rr},${rr} v${20 - 2 * rr} q0,${rr} ${-rr},${rr} h${-(w - rr)} z`} />
            <text x={labelW + w + 6} y={yTop + 14} fontSize="11" fontWeight="600" className={C.label}>
              {hrs} ชม.
              {r.lateDays > 0 && (
                <tspan fontWeight="400" className="fill-amber-600 dark:fill-amber-500">
                  {` · สาย ${r.lateDays}`}
                </tspan>
              )}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** แท่งซ้อนแนวนอนอันเดียว: สัดส่วนสถานะ (ปกติ/รอตรวจ/ผิดปกติ) */
export function StatusBreakdownBar({ counts }: { counts: StatusCounts }) {
  const total = counts.normal + counts.pending + counts.suspicious
  if (total === 0)
    return <p className="py-4 text-center text-sm text-slate-400">ยังไม่มีข้อมูล</p>

  const W = 660
  const H = 26
  const segs = [
    { v: counts.normal, cls: C.ok, label: 'ปกติ' },
    { v: counts.pending, cls: C.late, label: 'รอตรวจสอบ' },
    { v: counts.suspicious, cls: C.bad, label: 'ผิดปกติ' },
  ].filter((s) => s.v > 0)

  let acc = 0
  return (
    <div>
      <Legend
        items={[
          { cls: C.ok, label: `ปกติ ${counts.normal}` },
          { cls: C.late, label: `รอตรวจสอบ ${counts.pending}` },
          { cls: C.bad, label: `ผิดปกติ ${counts.suspicious}` },
        ]}
      />
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="สัดส่วนสถานะการเช็คอิน">
        {segs.map((s, i) => {
          const w = (s.v / total) * (W - (segs.length - 1) * 2)
          const x = acc
          acc += w + 2 // surface gap 2px
          const pct = Math.round((s.v / total) * 100)
          return (
            <g key={s.label}>
              <title>{`${s.label} ${s.v} รายการ (${pct}%)`}</title>
              <rect x={x} y="2" width={w} height="22" rx={i === 0 || i === segs.length - 1 ? 4 : 0} className={s.cls} />
              {w > 56 && (
                <text x={x + w / 2} y="17" textAnchor="middle" fontSize="11" fontWeight="600" className="fill-white">
                  {pct}%
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
