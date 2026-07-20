/**
 * เปรียบเทียบโซนเวลาด้วย "UTC offset จริง" แทนการเทียบชื่อ
 * เช่น Asia/Vientiane กับ Asia/Bangkok = UTC+7 เท่ากัน → ไม่ถือว่า mismatch
 * (พนักงานทำงานข้ามประเทศในโซนเวลาเดียวกัน ไม่ควรโดน flag)
 */

/** offset ของโซนเวลา ณ เวลาที่กำหนด (นาที) — null ถ้าโซนไม่รู้จัก */
export function tzOffsetMinutes(tz: string, at: Date = new Date()): number | null {
  try {
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'longOffset',
    }).format(at)
    // รูปแบบ: "... GMT+07:00" / "... GMT-03:30" / "... GMT" (=UTC)
    const m = s.match(/GMT(?:([+-])(\d{2}):(\d{2}))?/)
    if (!m) return null
    if (!m[1]) return 0
    const sign = m[1] === '-' ? -1 : 1
    return sign * (Number(m[2]) * 60 + Number(m[3]))
  } catch {
    return null // ชื่อโซนไม่ valid
  }
}

/**
 * true เมื่อโซนเวลาของเครื่อง "เวลาไม่ตรง" กับโซนบริษัทจริง ๆ
 * - เทียบด้วย offset ไม่ใช่ชื่อ (Vientiane == Bangkok)
 * - โซนที่อ่านไม่ออก/ไม่รู้จัก → ไม่ตัดสิน (false) กัน false positive
 */
export function isTimezoneMismatch(deviceTz: string | undefined | null, companyTz: string): boolean {
  if (!deviceTz) return false
  const dev = tzOffsetMinutes(deviceTz)
  const com = tzOffsetMinutes(companyTz)
  if (dev == null || com == null) return false
  return dev !== com
}

/**
 * เวลาเริ่มกะเป็น epoch ms — จาก "วันที่ของกะ" + เวลาเริ่ม (HH:MM) ในโซนเวลาบริษัท
 * ใช้คิด "มาสาย" ให้ถูกแม้เช็คอินก่อนเที่ยงคืนสำหรับกะของวันถัดไป
 * เช่น กะ 00:00 ของวันที่ 20, เช็คอิน 19 เวลา 23:45 → ยังไม่ถึงเวลาเริ่ม → ไม่สาย
 */
export function shiftStartUtcMs(workDate: string, startHHMM: string, tz: string): number | null {
  const off = tzOffsetMinutes(tz)
  if (off == null) return null
  const base = Date.parse(`${workDate}T${startHHMM}:00Z`)
  if (Number.isNaN(base)) return null
  return base - off * 60_000
}

/** เลื่อนวันที่ YYYY-MM-DD ไป n วัน */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
