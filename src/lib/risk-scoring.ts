/**
 * Risk scoring (0–100) — คำนวณฝั่ง server ตอน check-in / check-out
 * รวมสัญญาณความผิดปกติทั้งหมดเป็นคะแนนเดียว + เก็บ "เหตุผล" ให้แอดมินตรวจ
 *
 * Mapping: 0–30 normal · 31–60 review · 61–100 suspicious
 */

export type RiskLevel = 'normal' | 'review' | 'suspicious'

export interface RiskFactor {
  code: string
  label: string
  weight: number
}

export interface RiskInput {
  outsideGeofence?: boolean
  locationDenied?: boolean
  lowAccuracyMeters?: number | null // accuracy ที่วัดได้ (เมตร)
  newDevice?: boolean // อุปกรณ์ใหม่/ยังไม่อนุมัติ
  timezoneMismatch?: boolean // tz ของเครื่อง != tz บริษัท
  ipChangesToday?: number // จำนวนครั้งที่ IP เปลี่ยนในวันเดียว
  userAgentChanged?: boolean
  missingWorkSummary?: boolean // เช็คเอาต์ไม่มีสรุปงาน
  missedPresenceChecks?: number
}

const RULES: Array<{
  code: string
  label: string
  weight: number
  test: (i: RiskInput) => boolean | number
}> = [
  { code: 'outside_geofence', label: 'เช็คอินนอกพื้นที่ที่กำหนด', weight: 35, test: (i) => !!i.outsideGeofence },
  { code: 'location_denied', label: 'ปิดการเข้าถึงตำแหน่ง', weight: 20, test: (i) => !!i.locationDenied },
  { code: 'low_accuracy', label: 'ความแม่นยำตำแหน่งต่ำมาก (>1000m)', weight: 20, test: (i) => (i.lowAccuracyMeters ?? 0) > 1000 },
  { code: 'new_device', label: 'ใช้อุปกรณ์ใหม่ที่ยังไม่อนุมัติ', weight: 30, test: (i) => !!i.newDevice },
  { code: 'timezone_mismatch', label: 'โซนเวลาไม่ตรงกับประเทศที่ทำงาน', weight: 25, test: (i) => !!i.timezoneMismatch },
  { code: 'ip_changes', label: 'IP เปลี่ยนผิดปกติหลายครั้งในวันเดียว', weight: 15, test: (i) => (i.ipChangesToday ?? 0) > 3 },
  { code: 'ua_changed', label: 'User agent เปลี่ยนผิดปกติ', weight: 15, test: (i) => !!i.userAgentChanged },
  { code: 'missing_summary', label: 'เช็คเอาต์โดยไม่มีสรุปงาน', weight: 10, test: (i) => !!i.missingWorkSummary },
  // ไม่ตอบ presence check: 20 ต่อครั้ง
  { code: 'missed_presence', label: 'ไม่ตอบ random presence check', weight: 20, test: (i) => i.missedPresenceChecks ?? 0 },
]

export interface RiskResult {
  score: number
  level: RiskLevel
  factors: RiskFactor[]
}

export function computeRisk(input: RiskInput): RiskResult {
  const factors: RiskFactor[] = []
  let score = 0

  for (const rule of RULES) {
    const result = rule.test(input)
    if (typeof result === 'number') {
      if (result > 0) {
        const w = rule.weight * result
        score += w
        factors.push({ code: rule.code, label: `${rule.label} (${result} ครั้ง)`, weight: w })
      }
    } else if (result) {
      score += rule.weight
      factors.push({ code: rule.code, label: rule.label, weight: rule.weight })
    }
  }

  score = Math.min(100, score)
  return { score, level: toLevel(score), factors }
}

export function toLevel(score: number): RiskLevel {
  if (score >= 61) return 'suspicious'
  if (score >= 31) return 'review'
  return 'normal'
}

/** แปลง risk level → attendance status */
export function riskToStatus(level: RiskLevel): 'normal' | 'pending_review' | 'suspicious' {
  if (level === 'suspicious') return 'suspicious'
  if (level === 'review') return 'pending_review'
  return 'normal'
}
