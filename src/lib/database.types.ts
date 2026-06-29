/**
 * Database types
 * ในโปรเจกต์จริงให้ generate ด้วย: `npm run db:types`
 * (supabase gen types typescript --local > src/lib/database.types.ts)
 * ไฟล์นี้เป็นเวอร์ชัน hand-authored ที่ครอบคลุมตารางหลักเพื่อให้ type-safe ทันที
 */

export type UserRole = 'super_admin' | 'admin' | 'employee'
export type AttendanceStatus = 'normal' | 'pending_review' | 'suspicious'
export type DeviceStatus = 'pending_review' | 'approved' | 'rejected' | 'revoked'
export type PresenceStatus = 'pending' | 'acknowledged' | 'missed'
export type WorkLogStatus = 'planned' | 'in_progress' | 'done' | 'blocked'
export type AdjustmentStatus = 'pending' | 'approved' | 'rejected'
export type RiskLevelDb = 'normal' | 'review' | 'suspicious'

type Timestamps = { created_at: string; updated_at: string }

export type Team = Timestamps & {
  id: string
  name: string
  timezone: string
  work_start: string
  work_end: string
  late_grace_minutes: number
  created_by: string | null
  deleted_at: string | null
}

export type AppUser = Timestamps & {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  team_id: string | null
  shift_id: string | null
  is_active: boolean
  created_by: string | null
  deleted_at: string | null
}

export type Shift = Timestamps & {
  id: string
  name: string
  start_time: string
  end_time: string
  late_grace_minutes: number
  is_active: boolean
  created_by: string | null
  deleted_at: string | null
}

export type AllowedEmail = Timestamps & {
  id: string
  email: string
  role: UserRole
  team_id: string | null
  full_name: string | null
  used_at: string | null
  created_by: string | null
  deleted_at: string | null
}

export type EmployeeProfile = Timestamps & {
  id: string
  user_id: string
  employee_code: string | null
  phone: string | null
  position: string | null
  max_devices: number
  consent_at: string | null
  created_by: string | null
  deleted_at: string | null
}

export type WorkLocation = Timestamps & {
  id: string
  user_id: string
  label: string
  latitude: number
  longitude: number
  radius_meters: number
  is_active: boolean
  created_by: string | null
  deleted_at: string | null
}

export type RegisteredDevice = Timestamps & {
  id: string
  user_id: string
  fingerprint: string
  label: string | null
  browser: string | null
  os: string | null
  screen: string | null
  timezone: string | null
  user_agent: string | null
  status: DeviceStatus
  last_seen_at: string | null
  approved_by: string | null
  approved_at: string | null
  created_by: string | null
  deleted_at: string | null
}

export type AttendanceRecord = Timestamps & {
  id: string
  user_id: string
  team_id: string | null
  shift_id: string | null
  work_date: string
  check_in_time: string | null
  check_in_lat: number | null
  check_in_lng: number | null
  check_in_accuracy: number | null
  check_in_ip: string | null
  check_in_device_id: string | null
  check_in_within_geofence: boolean | null
  check_in_selfie_path: string | null
  work_plan: string | null
  is_late: boolean
  check_out_time: string | null
  check_out_lat: number | null
  check_out_lng: number | null
  check_out_accuracy: number | null
  check_out_ip: string | null
  check_out_device_id: string | null
  work_summary: string | null
  completed_work: string | null
  issues_faced: string | null
  risk_score: number
  risk_level: RiskLevelDb
  risk_factors: unknown
  status: AttendanceStatus
  worked_minutes: number | null
  deleted_at: string | null
}

export type PresenceCheck = Timestamps & {
  id: string
  attendance_id: string
  user_id: string
  scheduled_at: string
  respond_by: string
  acknowledged_at: string | null
  status: PresenceStatus
  ack_lat: number | null
  ack_lng: number | null
  ack_ip: string | null
  ack_device_id: string | null
  ack_selfie_path: string | null
}

export type WorkLog = Timestamps & {
  id: string
  attendance_id: string | null
  user_id: string
  title: string
  detail: string | null
  status: WorkLogStatus
  deleted_at: string | null
}

export type AdjustmentRequest = Timestamps & {
  id: string
  user_id: string
  attendance_id: string | null
  target_date: string
  requested_check_in: string | null
  requested_check_out: string | null
  reason: string
  evidence_path: string | null
  status: AdjustmentStatus
  reviewed_by: string | null
  reviewed_at: string | null
  admin_note: string | null
  deleted_at: string | null
}

export type AuditLog = {
  id: number
  actor_id: string | null
  actor_email: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: unknown
  ip: string | null
  user_agent: string | null
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  data: unknown
  read_at: string | null
  created_at: string
}

export type AppSetting = {
  key: string
  value: unknown
  description: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/** helper สร้างรูปแบบ Row/Insert/Update */
type TableShape<Row> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      teams: TableShape<Team>
      shifts: TableShape<Shift>
      users: TableShape<AppUser>
      allowed_emails: TableShape<AllowedEmail>
      employee_profiles: TableShape<EmployeeProfile>
      work_locations: TableShape<WorkLocation>
      registered_devices: TableShape<RegisteredDevice>
      attendance_records: TableShape<AttendanceRecord>
      presence_checks: TableShape<PresenceCheck>
      work_logs: TableShape<WorkLog>
      adjustment_requests: TableShape<AdjustmentRequest>
      audit_logs: TableShape<AuditLog>
      login_history: TableShape<{
        id: number
        user_id: string | null
        email: string | null
        ip: string | null
        user_agent: string | null
        device_fingerprint: string | null
        success: boolean
        reason: string | null
        created_at: string
      }>
      app_settings: TableShape<AppSetting>
      notifications: TableShape<Notification>
    }
    Views: Record<string, never>
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: UserRole }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_super_admin: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: {
      user_role: UserRole
      attendance_status: AttendanceStatus
      device_status: DeviceStatus
    }
    CompositeTypes: Record<string, never>
  }
}
