import { describe, it, expect } from 'vitest'
import { tzOffsetMinutes, isTimezoneMismatch } from '@/lib/tz'

describe('tzOffsetMinutes', () => {
  it('Bangkok = +420 นาที (UTC+7)', () => {
    expect(tzOffsetMinutes('Asia/Bangkok')).toBe(420)
  })
  it('Vientiane = +420 นาที (เท่ากับไทย)', () => {
    expect(tzOffsetMinutes('Asia/Vientiane')).toBe(420)
  })
  it('UTC = 0', () => {
    expect(tzOffsetMinutes('UTC')).toBe(0)
  })
  it('โซนติดลบ (America/New_York) เป็นค่าลบ', () => {
    const v = tzOffsetMinutes('America/New_York', new Date('2026-01-15T12:00:00Z'))
    expect(v).toBe(-300) // EST หน้าหนาว = -5 ชม.
  })
  it('โซนไม่รู้จัก → null', () => {
    expect(tzOffsetMinutes('Not/AZone')).toBeNull()
  })
})

describe('isTimezoneMismatch — พนักงานข้ามประเทศโซนเดียวกันไม่โดน flag', () => {
  it('ลาว (Vientiane) vs บริษัทไทย (Bangkok) → ไม่ mismatch', () => {
    expect(isTimezoneMismatch('Asia/Vientiane', 'Asia/Bangkok')).toBe(false)
  })
  it('Jakarta (+7) vs Bangkok → ไม่ mismatch', () => {
    expect(isTimezoneMismatch('Asia/Jakarta', 'Asia/Bangkok')).toBe(false)
  })
  it('สิงคโปร์ (+8) vs Bangkok → mismatch', () => {
    expect(isTimezoneMismatch('Asia/Singapore', 'Asia/Bangkok')).toBe(true)
  })
  it('ยุโรป vs Bangkok → mismatch', () => {
    expect(isTimezoneMismatch('Europe/London', 'Asia/Bangkok')).toBe(true)
  })
  it('ไม่มีค่า/โซนพัง → ไม่ตัดสิน (false)', () => {
    expect(isTimezoneMismatch(undefined, 'Asia/Bangkok')).toBe(false)
    expect(isTimezoneMismatch('Not/AZone', 'Asia/Bangkok')).toBe(false)
  })
})
