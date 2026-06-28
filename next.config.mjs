/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // อนุญาตเฉพาะ header ที่จำเป็นต่อการทำงานของกล้อง/ตำแหน่ง (เช็คอิน WFH)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // เปิดสิทธิ์กล้อง/ตำแหน่งเฉพาะ origin ตัวเอง
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), geolocation=(self), microphone=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
