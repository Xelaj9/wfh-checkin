import { describe, it, expect } from 'vitest'
import { tzOffsetMinutes, isTimezoneMismatch, shiftStartUtcMs, addDays } from '@/lib/tz'

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

describe('shiftStartUtcMs / addDays — เข้าก่อนเที่ยงคืนของกะวันถัดไป', () => {
  it('กะ 00:00 วันที่ 20 (Bangkok) = 19 เวลา 17:00 UTC', () => {
    const ms = shiftStartUtcMs('2026-06-20', '00:00', 'Asia/Bangkok')
    expect(ms).toBe(Date.parse('2026-06-19T17:00:00Z'))
  })
  it('เช็คอิน 19 เวลา 23:45 (16:45Z) ก่อนกะ 00:00 ของวันที่ 20 → ไม่สาย', () => {
    const start = shiftStartUtcMs('2026-06-20', '00:00', 'Asia/Bangkok')!
    const checkin = Date.parse('2026-06-19T16:45:00Z')
    expect(checkin < start + 15 * 60_000).toBe(true)
  })
  it('เช็คอิน 20 เวลา 00:30 กะ 00:00 grace 15 → สาย', () => {
    const start = shiftStartUtcMs('2026-06-20', '00:00', 'Asia/Bangkok')!
    const checkin = Date.parse('2026-06-19T17:30:00Z')
    expect(checkin > start + 15 * 60_000).toBe(true)
  })
  it('addDays ข้ามเดือน/ปี', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('โซนพัง → null', () => {
    expect(shiftStartUtcMs('2026-06-20', '00:00', 'Not/AZone')).toBeNull()
  })
})
