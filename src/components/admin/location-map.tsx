'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export interface MapPoint {
  lat: number
  lng: number
  label: string
  accuracy?: number | null
  status?: 'normal' | 'pending_review' | 'suspicious'
}

const COLOR: Record<string, string> = {
  normal: '#16a34a',
  pending_review: '#d97706',
  suspicious: '#dc2626',
}

/**
 * แผนที่ดูพิกัดเช็คอินคร่าว ๆ สำหรับแอดมิน (privacy: แสดงเท่าที่จำเป็นเพื่อตรวจสอบ)
 * ใช้ circleMarker + วงรัศมี accuracy — ไม่ใช้ marker icon เพื่อเลี่ยงปัญหา asset ของ bundler
 * โหลด Leaflet แบบ dynamic ฝั่ง client เท่านั้น
 */
export function LocationMap({ points }: { points: MapPoint[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || points.length === 0) return
    let map: import('leaflet').Map | null = null

    ;(async () => {
      const L = (await import('leaflet')).default
      map = L.map(ref.current!, { scrollWheelZoom: false })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      const latlngs: [number, number][] = []
      for (const p of points) {
        const color = COLOR[p.status ?? 'normal']
        L.circleMarker([p.lat, p.lng], {
          radius: 8,
          color,
          fillColor: color,
          fillOpacity: 0.6,
          weight: 2,
        })
          .bindPopup(`<b>${p.label}</b>${p.accuracy ? `<br>ความแม่นยำ ~${Math.round(p.accuracy)} ม.` : ''}`)
          .addTo(map!)

        // วงแสดงความคลาดเคลื่อนของ GPS
        if (p.accuracy && p.accuracy > 0) {
          L.circle([p.lat, p.lng], { radius: p.accuracy, color, opacity: 0.25, fillOpacity: 0.05 }).addTo(map!)
        }
        latlngs.push([p.lat, p.lng])
      }

      if (latlngs.length === 1) {
        map.setView(latlngs[0], 15)
      } else {
        map.fitBounds(latlngs, { padding: [30, 30] })
      }
    })()

    return () => {
      map?.remove()
    }
  }, [points])

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-400">
        ไม่มีพิกัดให้แสดง
      </div>
    )
  }

  return <div ref={ref} className="h-72 w-full overflow-hidden rounded-xl border" />
}
