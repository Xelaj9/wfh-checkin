import { describe, it, expect } from 'vitest'
import { haversineMeters, checkGeofence } from '@/lib/location'

// จุดอ้างอิง: สาทร กรุงเทพฯ
const HOME = { latitude: 13.7211, longitude: 100.53 }

describe('haversineMeters', () => {
  it('ระยะระหว่างจุดเดียวกัน = 0', () => {
    expect(haversineMeters(HOME, HOME)).toBe(0)
  })

  it('ระยะ ~1 องศา longitude ที่เส้นศูนย์สูตร ≈ 111 กม.', () => {
    const d = haversineMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 }
    )
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })

  it('คำนวณระยะใกล้ ๆ ได้สมเหตุผล (~150m)', () => {
    // ขยับ ~0.00135 องศา lat ≈ 150 เมตร
    const d = haversineMeters(HOME, { latitude: 13.7211 + 0.00135, longitude: 100.53 })
    expect(d).toBeGreaterThan(140)
    expect(d).toBeLessThan(160)
  })
})

describe('checkGeofence', () => {
  const area = { latitude: HOME.latitude, longitude: HOME.longitude, radius_meters: 200 }

  it('จุดในรัศมี → within = true', () => {
    const res = checkGeofence({ ...HOME }, [area])
    expect(res.within).toBe(true)
    expect(res.matchedAreaIndex).toBe(0)
  })

  it('จุดนอกรัศมี → within = false', () => {
    // ห่าง ~500 เมตร
    const far = { latitude: HOME.latitude + 0.0045, longitude: HOME.longitude }
    const res = checkGeofence(far, [area])
    expect(res.within).toBe(false)
    expect(res.matchedAreaIndex).toBeNull()
    expect(res.nearestDistance).toBeGreaterThan(400)
  })

  it('accuracy ของ GPS ถูกบวกเข้าไปในขอบเขต (เผื่อความคลาดเคลื่อน)', () => {
    // จุดห่าง ~250m เกินรัศมี 200 แต่ accuracy 100 → ผ่าน
    const point = { latitude: HOME.latitude + 0.00225, longitude: HOME.longitude, accuracy: 100 }
    const res = checkGeofence(point, [area])
    expect(res.within).toBe(true)
  })

  it('ไม่มีพื้นที่ที่กำหนด → within = false, ระยะ = Infinity', () => {
    const res = checkGeofence(HOME, [])
    expect(res.within).toBe(false)
    expect(res.nearestDistance).toBe(Infinity)
  })

  it('เลือกพื้นที่ที่ใกล้ที่สุดได้เมื่อมีหลายพื้นที่', () => {
    const office = { latitude: 13.75, longitude: 100.55, radius_meters: 200 }
    const res = checkGeofence(HOME, [office, area])
    expect(res.within).toBe(true)
    expect(res.matchedAreaIndex).toBe(1) // บ้านอยู่ใกล้กว่า
  })
})
