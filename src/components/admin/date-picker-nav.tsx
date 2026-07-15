'use client'

import { useRouter, useSearchParams } from 'next/navigation'

/** เลือกวันที่แล้วนำทางทันที (คงค่า query param อื่นไว้ เช่น status) */
export function DatePickerNav({
  value,
  max,
  basePath,
}: {
  value: string
  max?: string
  basePath: string
}) {
  const router = useRouter()
  const params = useSearchParams()

  function onChange(next: string) {
    if (!next) return
    const q = new URLSearchParams(params.toString())
    q.set('date', next)
    router.push(`${basePath}?${q.toString()}`)
  }

  return (
    <input
      type="date"
      value={value}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border px-3 py-1.5 text-sm"
      aria-label="เลือกวันที่"
    />
  )
}
