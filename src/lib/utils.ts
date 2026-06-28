import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** วันที่ทำงาน (YYYY-MM-DD) ตาม timezone ที่กำหนด */
export function workDateInTz(tz: string, date = new Date()): string {
  // ใช้ en-CA เพราะให้รูปแบบ YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** เวลา HH:mm ตาม timezone */
export function timeInTz(tz: string, iso: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatMinutes(min: number | null): string {
  if (min == null) return '-'
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h} ชม. ${m} นาที`
}
