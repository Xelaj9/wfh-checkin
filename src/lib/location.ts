/**
 * Location validation สำหรับ WFH
 * - คำนวณระยะ haversine ระหว่างจุดเช็คอินกับพื้นที่ที่อนุญาต
 * - เก็บพิกัดเฉพาะตอน check-in/out/presence check เท่านั้น (ไม่ track ตลอดวัน)
 */

export interface Coords {
  latitude: number
  longitude: number
  accuracy?: number
}

export interface GeofenceArea {
  latitude: number
  longitude: number
  radius_meters: number
}

/** ระยะทางระหว่าง 2 พิกัด (เมตร) */
export function haversineMeters(a: Coords, b: Coords): number {
  const R = 6_371_000 // รัศมีโลก (เมตร)
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface GeofenceResult {
  within: boolean
  /** ระยะถึงพื้นที่ที่ใกล้ที่สุด (เมตร) */
  nearestDistance: number
  matchedAreaIndex: number | null
}

/**
 * ตรวจว่าพิกัดอยู่ในพื้นที่อนุญาตใด ๆ หรือไม่
 * เผื่อ accuracy ของ GPS เข้าไปในการตัดสิน (ขอบเขต = radius + accuracy)
 */
export function checkGeofence(point: Coords, areas: GeofenceArea[]): GeofenceResult {
  if (areas.length === 0) {
    return { within: false, nearestDistance: Infinity, matchedAreaIndex: null }
  }
  let nearest = Infinity
  let matched: number | null = null
  const tolerance = point.accuracy ?? 0

  areas.forEach((area, i) => {
    const dist = haversineMeters(point, area)
    if (dist < nearest) nearest = dist
    if (dist <= area.radius_meters + tolerance) matched = i
  })

  return { within: matched !== null, nearestDistance: nearest, matchedAreaIndex: matched }
}
