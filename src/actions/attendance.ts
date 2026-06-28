'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientIp, writeAudit } from '@/lib/audit'
import { checkGeofence } from '@/lib/location'
import { computeRisk, riskToStatus, toLevel } from '@/lib/risk-scoring'
import { isDeviceClaimInconsistent, osFromUA } from '@/lib/ua'
import { workDateInTz } from '@/lib/utils'
import { getSettings } from '@/lib/settings'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

// ---- schema ของข้อมูลที่ client ส่งมา (validate ฝั่ง server) ----
const deviceSchema = z.object({
  fingerprint: z.string().min(8),
  browser: z.string().optional(),
  os: z.string().optional(),
  screen: z.string().optional(),
  timezone: z.string().optional(),
  userAgent: z.string().optional(),
})

const checkInSchema = z.object({
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  accuracy: z.number().nullable(),
  locationDenied: z.boolean(),
  device: deviceSchema,
  workPlan: z.string().max(2000).optional(),
  selfiePath: z.string().optional(),
})

const checkOutSchema = z.object({
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  accuracy: z.number().nullable(),
  device: deviceSchema,
  workSummary: z.string().max(2000).optional(),
  completedWork: z.string().max(2000).optional(),
  issuesFaced: z.string().max(2000).optional(),
})

export type ActionResult =
  | { ok: true; status: string; message: string }
  | { ok: false; error: string }

/** หา/สร้าง record อุปกรณ์จาก fingerprint; คืน {id, isNew} */
async function resolveDevice(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  device: z.infer<typeof deviceSchema>
): Promise<{ id: string; isNew: boolean; approved: boolean }> {
  const { data: existing } = await admin
    .from('registered_devices')
    .select('id, status')
    .eq('user_id', userId)
    .eq('fingerprint', device.fingerprint)
    .maybeSingle()

  if (existing) {
    await admin
      .from('registered_devices')
      .update({ last_seen_at: new Date().toISOString() } as never)
      .eq('id', existing.id)
    return {
      id: existing.id,
      isNew: false,
      approved: existing.status === 'approved',
    }
  }

  // อุปกรณ์ใหม่ → สร้างเป็น pending_review
  const { data: created } = await admin
    .from('registered_devices')
    .insert({
      user_id: userId,
      fingerprint: device.fingerprint,
      browser: device.browser,
      os: device.os,
      screen: device.screen,
      timezone: device.timezone,
      user_agent: device.userAgent,
      status: 'pending_review',
      last_seen_at: new Date().toISOString(),
    } as never)
    .select('id')
    .single()

  await writeAudit({
    action: 'new_device_detected',
    actorId: userId,
    entityType: 'device',
    entityId: created?.id,
    metadata: { fingerprint: device.fingerprint, os: device.os, browser: device.browser },
  })

  return { id: created!.id, isNew: true, approved: false }
}

// ===========================================================================
// CHECK IN
// ===========================================================================
export async function checkInAction(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' }

  const parsed = checkInSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  const data = parsed.data

  const admin = createAdminClient()
  const supabase = createClient()

  // timezone ของทีม (สำหรับคำนวณ work_date และมาสาย)
  const { data: team } = await supabase
    .from('teams')
    .select('timezone, work_start, late_grace_minutes')
    .eq('id', user.team_id ?? '')
    .maybeSingle()
  const tz = team?.timezone ?? DEFAULT_TZ
  const workDate = workDateInTz(tz)

  // กัน duplicate check-in ในวันเดียว
  const { data: existing } = await admin
    .from('attendance_records')
    .select('id, check_in_time')
    .eq('user_id', user.id)
    .eq('work_date', workDate)
    .maybeSingle()
  if (existing?.check_in_time) {
    return { ok: false, error: 'คุณเช็คอินของวันนี้ไปแล้ว' }
  }

  const settings = await getSettings()

  // ตรวจ setting: ปิด location = เช็คอินได้ไหม
  if (data.locationDenied && settings.block_checkin_without_location) {
    await writeAudit({ action: 'location_denied', actorId: user.id })
    return { ok: false, error: 'บริษัทกำหนดให้เปิดตำแหน่งก่อนเช็คอิน' }
  }

  // ตรวจ setting: บังคับ selfie ตอนเช็คอิน
  if (settings.selfie_required && !data.selfiePath) {
    return { ok: false, error: 'บริษัทกำหนดให้ถ่ายรูปยืนยันตัวตนก่อนเช็คอิน' }
  }

  // geofence
  let withinGeofence: boolean | null = null
  if (!data.locationDenied && data.lat != null && data.lng != null) {
    const { data: locations } = await admin
      .from('work_locations')
      .select('latitude, longitude, radius_meters')
      .eq('user_id', user.id)
      .eq('is_active', true)
    const geo = checkGeofence(
      { latitude: data.lat, longitude: data.lng, accuracy: data.accuracy ?? undefined },
      (locations ?? []).map((l) => ({
        latitude: l.latitude,
        longitude: l.longitude,
        radius_meters: l.radius_meters,
      }))
    )
    withinGeofence = geo.within
  }

  // device
  const device = await resolveDevice(admin, user.id, data.device)

  // timezone mismatch (เครื่อง vs บริษัท)
  const tzMismatch = !!data.device.timezone && data.device.timezone !== tz

  // มาสาย?
  const now = new Date()
  const isLate = computeIsLate(now, tz, team?.work_start ?? '09:00', team?.late_grace_minutes ?? 15)

  // IP ของ request (server-side — ปลอมจาก client ไม่ได้)
  const ip = getClientIp()

  // นับจำนวน IP ที่ไม่ซ้ำกันที่ใช้ login วันนี้ (สัญญาณ IP เปลี่ยนผิดปกติ)
  const since = `${workDate}T00:00:00Z`
  const { data: todayLogins } = await admin
    .from('login_history')
    .select('ip')
    .eq('user_id', user.id)
    .gte('created_at', since)
  const distinctIps = new Set(
    [...(todayLogins ?? []).map((l) => l.ip).filter(Boolean), ip].filter(Boolean) as string[]
  )

  // ตรวจการปลอม device: UA จริงจาก header (server) เทียบกับที่ client อ้าง
  const headerUA = headers().get('user-agent')
  const uaTampered = isDeviceClaimInconsistent(headerUA, data.device.os, data.device.browser)

  // risk
  const risk = computeRisk({
    outsideGeofence: withinGeofence === false,
    locationDenied: data.locationDenied,
    lowAccuracyMeters: data.accuracy,
    newDevice: !device.approved,
    timezoneMismatch: tzMismatch,
    ipChangesToday: distinctIps.size,
    userAgentChanged: uaTampered,
  })
  const status = riskToStatus(risk.level)

  // เขียน attendance ผ่าน service role
  const { error } = await admin
    .from('attendance_records')
    .upsert(
      {
        id: existing?.id,
        user_id: user.id,
        team_id: user.team_id,
        work_date: workDate,
        check_in_time: now.toISOString(),
        check_in_lat: data.lat,
        check_in_lng: data.lng,
        check_in_accuracy: data.accuracy,
        check_in_ip: ip,
        check_in_device_id: device.id,
        check_in_within_geofence: withinGeofence,
        check_in_selfie_path: data.selfiePath ?? null,
        work_plan: data.workPlan ?? null,
        is_late: isLate,
        risk_score: risk.score,
        risk_level: risk.level,
        risk_factors: risk.factors as never,
        status,
      } as never,
      { onConflict: 'user_id,work_date' }
    )

  if (error) {
    await writeAudit({ action: 'failed_check_in', actorId: user.id, metadata: { error: error.message } })
    return { ok: false, error: 'บันทึกการเช็คอินไม่สำเร็จ' }
  }

  await writeAudit({
    action: 'check_in',
    actorId: user.id,
    actorEmail: user.email,
    entityType: 'attendance',
    metadata: {
      workDate,
      status,
      riskScore: risk.score,
      withinGeofence,
      newDevice: device.isNew,
      distinctIpsToday: distinctIps.size,
      uaTampered,
      claimedOs: data.device.os,
      realOs: headerUA ? osFromUA(headerUA) : null,
    },
  })

  revalidatePath('/app')

  const messages: Record<string, string> = {
    normal: 'เช็คอินสำเร็จ ขอให้เป็นวันที่ดี!',
    pending_review: 'เช็คอินแล้ว แต่ระบบขอตรวจสอบเพิ่มเติม (อยู่นอกพื้นที่/อุปกรณ์ใหม่)',
    suspicious: 'เช็คอินแล้ว แต่พบความผิดปกติหลายจุด แอดมินจะตรวจสอบ',
  }
  return { ok: true, status, message: messages[status] }
}

// ===========================================================================
// CHECK OUT
// ===========================================================================
export async function checkOutAction(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' }

  const parsed = checkOutSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ข้อมูลไม่ถูกต้อง' }
  const data = parsed.data

  const admin = createAdminClient()
  const supabase = createClient()

  const { data: team } = await supabase
    .from('teams')
    .select('timezone')
    .eq('id', user.team_id ?? '')
    .maybeSingle()
  const tz = team?.timezone ?? DEFAULT_TZ
  const workDate = workDateInTz(tz)

  const { data: record } = await admin
    .from('attendance_records')
    .select('id, check_in_time, check_out_time, risk_score, risk_factors')
    .eq('user_id', user.id)
    .eq('work_date', workDate)
    .maybeSingle()

  if (!record?.check_in_time) return { ok: false, error: 'ยังไม่ได้เช็คอินวันนี้' }
  if (record.check_out_time) return { ok: false, error: 'คุณเช็คเอาต์ไปแล้ว' }

  const device = await resolveDevice(admin, user.id, data.device)
  const now = new Date()
  const workedMinutes = Math.round(
    (now.getTime() - new Date(record.check_in_time).getTime()) / 60000
  )

  // เพิ่มความเสี่ยงถ้าไม่กรอกสรุปงาน
  const extra = computeRisk({ missingWorkSummary: !data.workSummary })
  const newScore = Math.min(100, (record.risk_score ?? 0) + extra.score)
  const newLevel = toLevel(newScore)

  const ip = getClientIp()
  const { error } = await admin
    .from('attendance_records')
    .update({
      check_out_time: now.toISOString(),
      check_out_lat: data.lat,
      check_out_lng: data.lng,
      check_out_accuracy: data.accuracy,
      check_out_ip: ip,
      check_out_device_id: device.id,
      work_summary: data.workSummary ?? null,
      completed_work: data.completedWork ?? null,
      issues_faced: data.issuesFaced ?? null,
      worked_minutes: workedMinutes,
      risk_score: newScore,
      risk_level: newLevel,
      status: riskToStatus(newLevel),
    } as never)
    .eq('id', record.id)

  if (error) return { ok: false, error: 'บันทึกการเช็คเอาต์ไม่สำเร็จ' }

  await writeAudit({
    action: 'check_out',
    actorId: user.id,
    actorEmail: user.email,
    entityType: 'attendance',
    entityId: record.id,
    metadata: { workedMinutes, hasSummary: !!data.workSummary },
  })

  revalidatePath('/app')
  return { ok: true, status: 'normal', message: `เช็คเอาต์สำเร็จ ทำงานรวม ${Math.floor(workedMinutes / 60)} ชม. ${workedMinutes % 60} นาที` }
}

/** คำนวณว่ามาสายหรือไม่ โดยเทียบเวลาเข้างานตาม timezone */
function computeIsLate(now: Date, tz: string, workStart: string, graceMin: number): boolean {
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)
  const [h, m] = hhmm.split(':').map(Number)
  const [sh, sm] = workStart.split(':').map(Number)
  const nowMin = h * 60 + m
  const startMin = sh * 60 + sm + graceMin
  return nowMin > startMin
}
