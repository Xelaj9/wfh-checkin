/**
 * แยกพิกัด (lat, lng) จากข้อความ/ลิงก์แผนที่
 * รองรับ: Google Maps (@lat,lng / q= / !3d!4d), Apple Maps (ll=), geo:, พิกัดดิบ "lat,lng"
 * ใช้ได้ทั้ง client และ server (pure function)
 */

export interface LatLng {
  lat: number
  lng: number
}

function valid(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // กันเคส (0,0) ที่มักเป็นค่า parse ผิด
    !(lat === 0 && lng === 0)
  )
}

/** ลอง parse พิกัดจากสตริง (ลิงก์เต็ม หรือพิกัดดิบ) — คืน null ถ้าไม่พบ */
export function parseCoordsFromText(input: string): LatLng | null {
  if (!input) return null
  let text = input.trim()
  try {
    text = decodeURIComponent(text)
  } catch {
    /* ignore */
  }

  const patterns: RegExp[] = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // Google /@lat,lng
    /[?&](?:q|query|destination)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // ?q=lat,lng
    /[?&]ll=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // Apple ?ll=lat,lng
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, // Google place data !3dLAT!4dLNG
    /geo:(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // geo:lat,lng
    /^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/, // "lat, lng" ดิบ
  ]

  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const lat = parseFloat(m[1])
      const lng = parseFloat(m[2])
      if (valid(lat, lng)) return { lat, lng }
    }
  }
  return null
}

/** ตรวจว่าเป็นลิงก์ย่อที่ต้อง resolve (ตามไป redirect) หรือไม่ */
export function isShortMapLink(url: string): boolean {
  return /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|app\.goo\.gl)\//i.test(url.trim())
}

/** โดเมนที่อนุญาตให้ server ไป fetch (กัน SSRF) */
export function isAllowedMapHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase()
    return [
      'maps.app.goo.gl',
      'goo.gl',
      'app.goo.gl',
      'google.com',
      'www.google.com',
      'maps.google.com',
      'google.co.th',
      'maps.google.co.th',
      'apple.com',
      'maps.apple.com',
    ].some((allowed) => h === allowed || h.endsWith('.' + allowed))
  } catch {
    return false
  }
}
