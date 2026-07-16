import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSettings } from '@/lib/settings'
import { writeAudit } from '@/lib/audit'
import { workDateInTz } from '@/lib/utils'

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Asia/Bangkok'

/**
 * Cron: จัดการ random presence check (เรียกเป็นช่วง ๆ โดย Vercel Cron)
 * 1) ปิดรายการที่หมดเวลา → missed (+ เพิ่มความเสี่ยงให้ attendance)
 * 2) สุ่มสร้างรายการใหม่ให้พนักงานที่ "กำลังทำงาน" โดยไม่เกินจำนวนต่อวัน
 *
 * ป้องกันการเรียกมั่ว: ต้องส่ง header Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const settings = await getSettings()
  const nowIso = new Date().toISOString()
  const workDate = workDateInTz(DEFAULT_TZ)

  // 1) ปิดรายการที่เลย respond_by → missed
  const { data: expired } = await admin
    .from('presence_checks')
    .update({ status: 'missed' } as never)
    .eq('status', 'pending')
    .lt('respond_by', nowIso)
    .select('id, user_id, attendance_id')

  for (const e of expired ?? []) {
    await writeAudit({
      action: 'presence_missed',
      actorId: e.user_id,
      entityType: 'presence_check',
      entityId: e.id,
    })
    // เพิ่มความเสี่ยงให้ attendance ที่เกี่ยวข้อง
    const { data: rec } = await admin
      .from('attendance_records')
      .select('risk_score')
      .eq('id', e.attendance_id)
      .maybeSingle()
    if (rec) {
      const newScore = Math.min(100, (rec.risk_score ?? 0) + 20)
      await admin
        .from('attendance_records')
        .update({
          risk_score: newScore,
          risk_level: newScore >= 61 ? 'suspicious' : newScore >= 31 ? 'review' : 'normal',
          status: newScore >= 61 ? 'suspicious' : newScore >= 31 ? 'pending_review' : 'normal',
        } as never)
        .eq('id', e.attendance_id)
    }
  }

  // 1.5) ปิดรอบที่เปิดค้างนานผิดปกติ (>18 ชม.) อัตโนมัติ — กันรอบค้างถาวร
  // สมมติความยาวรอบ 8 ชม. + ตั้ง pending_review ให้แอดมินตรวจ (พนักงานส่งคำขอแก้เวลาได้)
  const staleCutoff = new Date(Date.now() - 18 * 3600_000).toISOString()
  const { data: staleRounds } = await admin
    .from('attendance_records')
    .select('id, user_id, check_in_time, risk_score')
    .not('check_in_time', 'is', null)
    .is('check_out_time', null)
    .lt('check_in_time', staleCutoff)
  let autoClosed = 0
  for (const s of staleRounds ?? []) {
    const inTime = new Date(s.check_in_time as string)
    const autoOut = new Date(inTime.getTime() + 8 * 3600_000)
    const newScore = Math.min(100, (s.risk_score ?? 0) + 10)
    await admin
      .from('attendance_records')
      .update({
        check_out_time: autoOut.toISOString(),
        worked_minutes: 480,
        work_summary: '[ปิดรอบอัตโนมัติ: ไม่มีการเช็คเอาต์]',
        risk_score: newScore,
        risk_level: newScore >= 61 ? 'suspicious' : 'review',
        status: newScore >= 61 ? 'suspicious' : 'pending_review',
      } as never)
      .eq('id', s.id)
    await writeAudit({
      action: 'auto_checkout',
      actorId: s.user_id,
      entityType: 'attendance',
      entityId: s.id,
      metadata: { reason: 'no_checkout_18h', assumedMinutes: 480 },
    })
    autoClosed++
  }

  // 2) สุ่มสร้างรายการใหม่
  let created = 0
  if (settings.presence_checks_per_day > 0) {
    // ทุก "รอบ" ของวันนี้ + รอบเปิดข้ามคืน (กะดึกหลังเที่ยงคืนก็ยังถูกสุ่ม)
    const { data: allToday } = await admin
      .from('attendance_records')
      .select('id, user_id, check_in_time, check_out_time')
      .eq('work_date', workDate)
      .not('check_in_time', 'is', null)
    const { data: openOvernight } = await admin
      .from('attendance_records')
      .select('id, user_id, check_in_time, check_out_time')
      .neq('work_date', workDate)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null)
      .gte('check_in_time', staleCutoff)

    const todayRows = [...(allToday ?? []), ...(openOvernight ?? [])]
    // รอบที่ยังเปิดอยู่ (กำลังทำงาน) — สุ่มได้เฉพาะกลุ่มนี้
    const active = todayRows.filter((r) => !r.check_out_time)

    // นับ presence ของ "ทุกรอบวันนี้" รวมกันต่อคน (query เดียว)
    const todayIds = todayRows.map((r) => r.id)
    const { data: todayChecks } = todayIds.length
      ? await admin.from('presence_checks').select('user_id, status').in('attendance_id', todayIds)
      : { data: [] }
    const totalByUser = new Map<string, number>()
    const pendingByUser = new Map<string, number>()
    for (const c of todayChecks ?? []) {
      totalByUser.set(c.user_id, (totalByUser.get(c.user_id) ?? 0) + 1)
      if (c.status === 'pending') pendingByUser.set(c.user_id, (pendingByUser.get(c.user_id) ?? 0) + 1)
    }

    for (const rec of active) {
      const todayCount = totalByUser.get(rec.user_id) ?? 0
      const pendingCount = pendingByUser.get(rec.user_id) ?? 0
      if (todayCount >= settings.presence_checks_per_day || pendingCount > 0) continue

      // สุ่มความน่าจะเป็น เพื่อไม่ให้ออกมาเป็นจังหวะเดียวกันทุกคน/ทุกครั้ง
      if (Math.random() > 0.5) continue

      const respondBy = new Date(Date.now() + settings.presence_response_minutes * 60_000)
      const { data: pc } = await admin
        .from('presence_checks')
        .insert({
          attendance_id: rec.id,
          user_id: rec.user_id,
          scheduled_at: nowIso,
          respond_by: respondBy.toISOString(),
          status: 'pending',
        } as never)
        .select('id')
        .single()

      await admin.from('notifications').insert({
        user_id: rec.user_id,
        type: 'presence_check',
        title: 'กรุณายืนยันตัวตน',
        body: `โปรดกดยืนยันภายใน ${settings.presence_response_minutes} นาที`,
        data: { presence_id: pc?.id },
      } as never)
      created++
      // อัปเดตตัวนับในหน่วยความจำ กันสุ่มซ้ำคนเดิมใน loop เดียวกัน
      totalByUser.set(rec.user_id, todayCount + 1)
      pendingByUser.set(rec.user_id, pendingCount + 1)
    }
  }

  return NextResponse.json({ ok: true, expired: expired?.length ?? 0, autoClosed, created })
}
