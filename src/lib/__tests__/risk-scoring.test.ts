import { describe, it, expect } from 'vitest'
import { computeRisk, toLevel, riskToStatus } from '@/lib/risk-scoring'

describe('computeRisk', () => {
  it('คืน normal เมื่อไม่มีสัญญาณผิดปกติ', () => {
    const r = computeRisk({})
    expect(r.score).toBe(0)
    expect(r.level).toBe('normal')
    expect(r.factors).toHaveLength(0)
  })

  it('นอกพื้นที่ที่กำหนด → +35 และติด factor', () => {
    const r = computeRisk({ outsideGeofence: true })
    expect(r.score).toBe(35)
    expect(r.level).toBe('review')
    expect(r.factors.map((f) => f.code)).toContain('outside_geofence')
  })

  it('อุปกรณ์ใหม่ + นอกพื้นที่ → สะสมเป็น suspicious', () => {
    const r = computeRisk({ outsideGeofence: true, newDevice: true })
    // 35 + 30 = 65
    expect(r.score).toBe(65)
    expect(r.level).toBe('suspicious')
  })

  it('accuracy > 1000m นับเป็นความเสี่ยง แต่ <=1000 ไม่นับ', () => {
    expect(computeRisk({ lowAccuracyMeters: 1500 }).score).toBe(20)
    expect(computeRisk({ lowAccuracyMeters: 800 }).score).toBe(0)
  })

  it('missed presence check คูณตามจำนวนครั้ง', () => {
    const r = computeRisk({ missedPresenceChecks: 2 })
    expect(r.score).toBe(40) // 20 * 2
    expect(r.factors[0].label).toContain('2 ครั้ง')
  })

  it('ipChangesToday นับเฉพาะเมื่อ > 3', () => {
    expect(computeRisk({ ipChangesToday: 3 }).score).toBe(0)
    expect(computeRisk({ ipChangesToday: 4 }).score).toBe(15)
  })

  it('คะแนนไม่เกิน 100 (clamp)', () => {
    const r = computeRisk({
      outsideGeofence: true,
      newDevice: true,
      timezoneMismatch: true,
      locationDenied: true,
      lowAccuracyMeters: 2000,
      missedPresenceChecks: 3,
    })
    expect(r.score).toBe(100)
    expect(r.level).toBe('suspicious')
  })
})

describe('toLevel — ขอบเขตคะแนน', () => {
  it('0–30 = normal', () => {
    expect(toLevel(0)).toBe('normal')
    expect(toLevel(30)).toBe('normal')
  })
  it('31–60 = review', () => {
    expect(toLevel(31)).toBe('review')
    expect(toLevel(60)).toBe('review')
  })
  it('61–100 = suspicious', () => {
    expect(toLevel(61)).toBe('suspicious')
    expect(toLevel(100)).toBe('suspicious')
  })
})

describe('riskToStatus', () => {
  it('map ระดับความเสี่ยง → สถานะ attendance', () => {
    expect(riskToStatus('normal')).toBe('normal')
    expect(riskToStatus('review')).toBe('pending_review')
    expect(riskToStatus('suspicious')).toBe('suspicious')
  })
})
