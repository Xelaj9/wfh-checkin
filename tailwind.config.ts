import type { Config } from 'tailwindcss'

const config: Config = {
  // สลับธีมด้วยคลาส `dark` บน <html> (เก็บค่าใน localStorage)
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        // สถานะของ attendance — ใช้สีให้สอดคล้องทั้งระบบ (ข้อ 18)
        status: {
          normal: '#16a34a',
          pending: '#d97706',
          suspicious: '#dc2626',
          review: '#ca8a04',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}

export default config
