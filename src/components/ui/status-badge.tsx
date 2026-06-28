import { cn } from '@/lib/utils'

const MAP: Record<string, { cls: string; label: string }> = {
  normal: { cls: 'badge-normal', label: 'ปกติ' },
  pending_review: { cls: 'badge-pending', label: 'รอตรวจสอบ' },
  suspicious: { cls: 'badge-suspicious', label: 'ผิดปกติ' },
  review: { cls: 'badge-pending', label: 'ควรตรวจสอบ' },
}

export function StatusBadge({ status }: { status: string }) {
  const item = MAP[status] ?? { cls: 'badge-normal', label: status }
  return <span className={cn('badge', item.cls)}>{item.label}</span>
}
