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
