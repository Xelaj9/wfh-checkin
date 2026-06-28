/**
 * Device fingerprint แบบ "privacy-friendly"
 * ใช้เฉพาะสัญญาณระดับ browser ที่ไม่ระบุตัวบุคคล: browser, OS, screen, timezone, UA
 * ไม่ใช้ canvas/webgl fingerprinting เชิงรุก หรืออ่านข้อมูลส่วนตัวในเครื่อง (ข้อ 17)
 *
 * เป้าหมาย: ตรวจว่า "เครื่องเดิมหรือไม่" เพื่อกันฝากเพื่อนกดแทน — ไม่ใช่ติดตามข้ามเว็บ
 */

export interface DeviceSignals {
  browser: string
  os: string
  screen: string
  timezone: string
  userAgent: string
}

/** อ่านสัญญาณจาก browser (เรียกฝั่ง client เท่านั้น) */
export function collectDeviceSignals(): DeviceSignals {
  const ua = navigator.userAgent
  return {
    browser: detectBrowser(ua),
    os: detectOS(ua),
    screen: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'unknown',
    userAgent: ua,
  }
}

/** สร้าง hash (SHA-256) จากสัญญาณหลักที่ค่อนข้างคงที่ */
export async function computeFingerprint(s: DeviceSignals): Promise<string> {
  // ไม่รวม userAgent เต็มใน hash เพราะเปลี่ยนบ่อย (เวอร์ชัน browser) — ใช้แกนที่นิ่งกว่า
  const basis = [s.browser, s.os, s.screen, s.timezone].join('|')
  const data = new TextEncoder().encode(basis)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function detectBrowser(ua: string): string {
  if (/edg/i.test(ua)) return 'Edge'
  if (/opr|opera/i.test(ua)) return 'Opera'
  if (/chrome|crios/i.test(ua)) return 'Chrome'
  if (/firefox|fxios/i.test(ua)) return 'Firefox'
  if (/safari/i.test(ua)) return 'Safari'
  return 'Unknown'
}

function detectOS(ua: string): string {
  if (/windows/i.test(ua)) return 'Windows'
  if (/android/i.test(ua)) return 'Android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS'
  if (/mac os x/i.test(ua)) return 'macOS'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Unknown'
}
