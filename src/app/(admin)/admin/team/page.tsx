import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/settings'
import { WhitelistManager } from '@/components/admin/whitelist-manager'
import { WorkLocationForm } from '@/components/admin/work-location-form'
import { ShiftsManager } from '@/components/admin/shifts-manager'
import { ShiftAssignTable } from '@/components/admin/shift-assign-table'
import { UserRoleManager } from '@/components/admin/user-role-manager'
import { WorkLocationTable, type LocationRow } from '@/components/admin/work-location-table'

export default async function TeamPage() {
  const me = await requireRole(['admin', 'super_admin'])
  const supabase = createClient()
  const settings = await getSettings()

  // ทั้งหมดถูกจำกัดขอบเขตด้วย RLS (admin เห็นเฉพาะทีมตัวเอง)
  const [{ data: entries }, { data: teams }, { data: employees }, { data: locations }, { data: shifts }] =
    await Promise.all([
      supabase
        .from('allowed_emails')
        .select('id, email, role, full_name, used_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('teams').select('id, name, work_start, work_end, late_grace_minutes').is('deleted_at', null),
      supabase
        .from('users')
        .select('id, full_name, email, shift_id')
        .in('role', ['employee', 'admin'])
        .eq('is_active', true)
        .order('full_name'),
      supabase.from('work_locations').select('*, users!work_locations_user_id_fkey(full_name, email)').eq('is_active', true),
      supabase.from('shifts').select('*').is('deleted_at', null).order('start_time'),
    ])

  // ผู้ใช้ทุกบทบาท (สำหรับจัดการสิทธิ์ — super_admin เห็นทุกคนผ่าน RLS)
  const { data: allMembers } =
    me.role === 'super_admin'
      ? await supabase
          .from('users')
          .select('id, full_name, email, role')
          .eq('is_active', true)
          .order('role')
          .order('full_name')
      : { data: null }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">ผู้ใช้ & พื้นที่ทำงาน</h1>

      <ShiftsManager shifts={shifts ?? []} />
      <ShiftAssignTable employees={employees ?? []} shifts={shifts ?? []} />

      <WhitelistManager
        entries={entries ?? []}
        teams={teams ?? []}
        isSuperAdmin={me.role === 'super_admin'}
        defaultTeamId={me.team_id}
      />

      {me.role === 'super_admin' && allMembers && (
        <UserRoleManager members={allMembers} myId={me.id} />
      )}

      <WorkLocationForm employees={employees ?? []} defaultRadius={settings.default_geofence_radius} />

      <WorkLocationTable
        locations={(locations ?? []).map((l): LocationRow => {
          const u = (l as { users?: { full_name?: string; email?: string } }).users
          return {
            id: l.id,
            label: l.label,
            latitude: l.latitude,
            longitude: l.longitude,
            radius_meters: l.radius_meters,
            ownerName: u?.full_name ?? u?.email ?? '-',
          }
        })}
      />
    </div>
  )
}
