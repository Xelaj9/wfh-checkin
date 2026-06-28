import { describe, it, expect } from 'vitest'
import { osFromUA, browserFromUA, isDeviceClaimInconsistent } from '@/lib/ua'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

describe('osFromUA / browserFromUA', () => {
  it('แยก iOS + Safari จาก UA ของ iPhone', () => {
    expect(osFromUA(IPHONE)).toBe('iOS')
    expect(browserFromUA(IPHONE)).toBe('Safari')
  })
  it('แยก Windows + Chrome', () => {
    expect(osFromUA(WINDOWS)).toBe('Windows')
    expect(browserFromUA(WINDOWS)).toBe('Chrome')
  })
})

describe('isDeviceClaimInconsistent — จับ device ปลอม', () => {
  it('client อ้าง iOS แต่ UA จริงเป็น Windows → ปลอม', () => {
    expect(isDeviceClaimInconsistent(WINDOWS, 'iOS', 'Safari')).toBe(true)
  })
  it('client อ้างตรงกับ UA จริง → ไม่ปลอม', () => {
    expect(isDeviceClaimInconsistent(IPHONE, 'iOS', 'Safari')).toBe(false)
  })
  it('ไม่มี header UA → ไม่ตัดสิน (false)', () => {
    expect(isDeviceClaimInconsistent(null, 'iOS', 'Safari')).toBe(false)
  })
  it('ฝั่งใดฝั่งหนึ่ง Unknown → ไม่ตัดสินว่าปลอม (กัน false positive)', () => {
    expect(isDeviceClaimInconsistent(WINDOWS, 'Unknown', undefined)).toBe(false)
  })
})
