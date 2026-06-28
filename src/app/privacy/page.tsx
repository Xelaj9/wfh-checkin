import Link from 'next/link'

// Privacy Notice (PDPA) — ข้อ 17: แจ้งชัดเจนว่าระบบเก็บอะไรบ้าง
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/login" className="text-sm text-slate-500">
        ← กลับ
      </Link>
      <h1 className="mt-4 text-2xl font-bold">นโยบายความเป็นส่วนตัว</h1>
      <p className="mt-2 text-sm text-slate-500">
        ระบบนี้ออกแบบให้เก็บข้อมูล “เท่าที่จำเป็น” ต่อการยืนยันการเข้างานเท่านั้น
      </p>

      <section className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
        <div>
          <h2 className="font-semibold text-slate-900">ข้อมูลที่เราเก็บ</h2>
          <ul className="mt-1 list-disc pl-5">
            <li>เวลาเข้า–ออกงาน และบันทึกงาน (แผน/สรุป)</li>
            <li>ตำแหน่ง (พิกัด) เฉพาะ <b>ตอนเช็คอิน เช็คเอาต์ และการสุ่มยืนยันตัวตน</b> เท่านั้น</li>
            <li>ข้อมูลอุปกรณ์แบบไม่ระบุตัวบุคคล: ชนิด browser, ระบบปฏิบัติการ, ขนาดหน้าจอ, โซนเวลา</li>
            <li>IP address และ user agent เพื่อความปลอดภัยและตรวจสอบย้อนหลัง</li>
            <li>รูปยืนยันตัวตน (selfie) เฉพาะเมื่อบริษัทเปิดใช้งาน — เก็บใน storage แบบส่วนตัว</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900">สิ่งที่เรา “ไม่” ทำ</h2>
          <ul className="mt-1 list-disc pl-5">
            <li>ไม่ติดตามตำแหน่งตลอดเวลา</li>
            <li>ไม่แอบเปิดกล้องหรือไมโครโฟน</li>
            <li>ไม่บันทึกการพิมพ์ (keylogger) ไม่จับภาพหน้าจอ</li>
            <li>ไม่อ่านไฟล์หรือข้อมูลส่วนตัวในเครื่องของคุณ</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900">ระยะเวลาจัดเก็บ</h2>
          <p>
            ข้อมูลถูกเก็บตามนโยบายบริษัท (เช่น 6 เดือน–1 ปี) และจะถูกลบหรือทำให้ไม่ระบุตัวตนเมื่อครบกำหนด
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900">สิทธิของคุณ</h2>
          <p>คุณสามารถขอเข้าถึง แก้ไข หรือสอบถามเกี่ยวกับข้อมูลของคุณได้ที่ผู้ดูแลระบบ</p>
        </div>
      </section>
    </main>
  )
}
