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

  // 2) สุ่มสร้างรายการใหม่
  let created = 0
  if (settings.presence_checks_per_day > 0) {
    // พนักงานที่กำลังทำงาน (เช็คอินแล้ว ยังไม่เช็คเอาต์)
    const { data: active } = await admin
      .from('attendance_records')
      .select('id, user_id')
      .eq('work_date', workDate)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null)

    for (const rec of active ?? []) {
      // นับ presence check ของวันนี้
      const { count } = await admin
        .from('presence_checks')
        .select('id', { count: 'exact', head: true })
        .eq('attendance_id', rec.id)

      const todayCount = count ?? 0
      // มี pending ค้างอยู่หรือไม่
      const { count: pendingCount } = await admin
        .from('presence_checks')
        .select('id', { count: 'exact', head: true })
        .eq('attendance_id', rec.id)
        .eq('status', 'pending')

      if (todayCount >= settings.presence_checks_per_day || (pendingCount ?? 0) > 0) continue

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
    }
  }

  return NextResponse.json({ ok: true, expired: expired?.length ?? 0, created })
}
