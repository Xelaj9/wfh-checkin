'use client'

import { useTransition } from 'react'
import { decideDeviceAction } from '@/actions/admin'

export function DeviceDecisionButtons({
  deviceId,
  userId,
}: {
  deviceId: string
  userId: string
}) {
  const [isPending, startTransition] = useTransition()

  function decide(decision: 'approved' | 'rejected') {
    startTransition(async () => {
      await decideDeviceAction({ deviceId, userId, decision })
    })
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => decide('approved')}
        disabled={isPending}
        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
      >
        อนุมัติ
      </button>
      <button
        onClick={() => decide('rejected')}
        disabled={isPending}
        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-60"
      >
        ปฏิเสธ
      </button>
    </div>
  )
}
