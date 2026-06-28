import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // สถานะของ attendance — ใช้สีให้สอดคล้องทั้งระบบ (ข้อ 18)
        status: {
          normal: '#16a34a', // เขียว
          pending: '#d97706', // ส้ม
          suspicious: '#dc2626', // แดง
          review: '#ca8a04', // เหลือง
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
