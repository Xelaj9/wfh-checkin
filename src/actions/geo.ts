'use server'

import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { parseCoordsFromText, isAllowedMapHost, type LatLng } from '@/lib/geo-link'

type Result = { ok: true; lat: number; lng: number; source: string } | { ok: false; error: string }

const schema = z.object({ link: z.string().min(3).max(2000) })

/**
 * แปลงลิงก์แผนที่ (Google/Apple/พิกัดดิบ) → พิกัด
 * - ลองแยกพิกัดจากข้อความก่อน
 * - ถ้าเป็นลิงก์ย่อ/ไม่มีพิกัดในตัว → fetch ตาม redirect (เฉพาะโดเมนแผนที่ที่อนุญาต) แล้วแยกจาก URL สุดท้าย/เนื้อหา
 * เฉพาะแอดมิน (ใช้ตอนตั้ง geofence)
 */
export async function resolveLocationLinkAction(input: unknown): Promise<Result> {
  const me = await getCurrentUser()
  if (!me || (me.role !== 'admin' && me.role !== 'super_admin')) {
    return { ok: false, error: 'ไม่มีสิทธิ์' }
  }

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'ลิงก์ไม่ถูกต้อง' }
  const link = parsed.data.link.trim()

  // 1) ลองแยกจากข้อความตรง ๆ (ลิงก์เต็ม / พิกัดดิบ)
  const direct = parseCoordsFromText(link)
  if (direct) return ok(direct, 'link')

  // 2) ต้องเป็น URL ของโดเมนแผนที่ที่อนุญาต (กัน SSRF)
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return { ok: false, error: 'กรุณาวางลิงก์ Google Maps หรือพิกัด (เช่น 13.72, 100.53)' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, error: 'ลิงก์ไม่รองรับ' }
  if (!isAllowedMapHost(link)) return { ok: false, error: 'รองรับเฉพาะลิงก์ Google Maps / Apple Maps' }

  // 3) ตาม redirect แล้วแยกพิกัดจาก URL สุดท้าย + เนื้อหา
  try {
    const res = await fetch(link, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WFHCheckin/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })

    // จาก URL สุดท้ายหลัง redirect
    const fromUrl = parseCoordsFromText(res.url)
    if (fromUrl) return ok(fromUrl, 'redirect')

    // จากเนื้อหา (จำกัดขนาด)
    const body = (await res.text()).slice(0, 200_000)
    const fromBody = parseCoordsFromText(body)
    if (fromBody) return ok(fromBody, 'page')

    return { ok: false, error: 'ดึงพิกัดจากลิงก์ไม่ได้ — ลองเปิดลิงก์แล้วก็อปพิกัด (เลขสองตัว) มาวางแทน' }
  } catch {
    return { ok: false, error: 'เข้าถึงลิงก์ไม่สำเร็จ ลองใหม่หรือวางพิกัดตรง ๆ' }
  }
}

function ok(c: LatLng, source: string): Result {
  // ปัดทศนิยม ~6 ตำแหน่ง (พอสำหรับ geofence)
  return { ok: true, lat: Math.round(c.lat * 1e6) / 1e6, lng: Math.round(c.lng * 1e6) / 1e6, source }
}
