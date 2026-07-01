import { describe, it, expect } from 'vitest'
import { parseCoordsFromText, isAllowedMapHost, isShortMapLink } from '@/lib/geo-link'

describe('parseCoordsFromText', () => {
  it('พิกัดดิบ "lat, lng"', () => {
    expect(parseCoordsFromText('13.7211, 100.5300')).toEqual({ lat: 13.7211, lng: 100.53 })
  })
  it('Google /@lat,lng,zoom', () => {
    const r = parseCoordsFromText('https://www.google.com/maps/@13.7211,100.53,17z')
    expect(r).toEqual({ lat: 13.7211, lng: 100.53 })
  })
  it('Google ?q=lat,lng', () => {
    expect(parseCoordsFromText('https://maps.google.com/?q=13.75,100.55')).toEqual({ lat: 13.75, lng: 100.55 })
  })
  it('Google place data !3d!4d', () => {
    const r = parseCoordsFromText('https://www.google.com/maps/place/x/data=!3d13.72!4d100.53')
    expect(r).toEqual({ lat: 13.72, lng: 100.53 })
  })
  it('Apple ?ll=lat,lng', () => {
    expect(parseCoordsFromText('https://maps.apple.com/?ll=13.72,100.53')).toEqual({ lat: 13.72, lng: 100.53 })
  })
  it('geo: URI', () => {
    expect(parseCoordsFromText('geo:13.72,100.53')).toEqual({ lat: 13.72, lng: 100.53 })
  })
  it('ปฏิเสธค่าที่ไม่ใช่พิกัด', () => {
    expect(parseCoordsFromText('https://maps.app.goo.gl/abcd')).toBeNull()
    expect(parseCoordsFromText('hello world')).toBeNull()
  })
  it('ปฏิเสธ (0,0)', () => {
    expect(parseCoordsFromText('0,0')).toBeNull()
  })
})

describe('isShortMapLink / isAllowedMapHost', () => {
  it('รู้จักลิงก์ย่อ', () => {
    expect(isShortMapLink('https://maps.app.goo.gl/xY')).toBe(true)
    expect(isShortMapLink('https://www.google.com/maps/@1,2')).toBe(false)
  })
  it('อนุญาตเฉพาะโดเมนแผนที่ (กัน SSRF)', () => {
    expect(isAllowedMapHost('https://maps.app.goo.gl/xY')).toBe(true)
    expect(isAllowedMapHost('https://www.google.com/maps')).toBe(true)
    expect(isAllowedMapHost('https://evil.com/maps')).toBe(false)
    expect(isAllowedMapHost('http://169.254.169.254/latest')).toBe(false)
  })
})
