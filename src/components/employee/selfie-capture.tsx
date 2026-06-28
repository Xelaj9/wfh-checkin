'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * ถ่าย selfie สดจากกล้อง (ไม่ใช่อัปโหลดไฟล์) แล้วอัปขึ้น private bucket
 * - ขอสิทธิ์กล้องเฉพาะตอนเปิดคอมโพเนนต์นี้ (ไม่แอบเปิด)
 * - คืน path ของไฟล์ผ่าน onCaptured เพื่อแนบไปกับ check-in / presence
 */
export function SelfieCapture({
  userId,
  purpose,
  onCaptured,
}: {
  userId: string
  purpose: 'checkin' | 'presence'
  onCaptured: (path: string | null) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        setError('ไม่สามารถเปิดกล้องได้ — โปรดอนุญาตการใช้กล้อง')
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  async function capture() {
    const video = videoRef.current
    if (!video) return
    setUploading(true)
    setError(null)

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 480
    canvas.height = video.videoHeight || 640
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    setPreview(canvas.toDataURL('image/jpeg', 0.7))

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.7)
    )
    if (!blob) {
      setError('สร้างรูปไม่สำเร็จ')
      setUploading(false)
      return
    }

    // path ใต้โฟลเดอร์ของผู้ใช้ (RLS อนุญาตอัปเฉพาะ <userId>/...)
    const path = `${userId}/${purpose}/${Date.now()}.jpg`
    const supabase = createClient()
    const { error: upErr } = await supabase.storage
      .from('evidence')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })

    if (upErr) {
      setError('อัปโหลดรูปไม่สำเร็จ')
      setUploading(false)
      onCaptured(null)
      return
    }

    stopCamera()
    setUploading(false)
    onCaptured(path)
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
  }

  return (
    <div className="space-y-2">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="selfie" className="w-full rounded-lg" />
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black" />
      )}
      {!preview && (
        <button
          type="button"
          onClick={capture}
          disabled={uploading}
          className="w-full rounded-lg bg-slate-700 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {uploading ? 'กำลังอัปโหลด…' : '📸 ถ่ายรูปยืนยัน'}
        </button>
      )}
      {preview && <p className="text-center text-xs text-green-600">✓ ถ่ายรูปเรียบร้อย</p>}
    </div>
  )
}
