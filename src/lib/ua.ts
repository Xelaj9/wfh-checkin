/**
 * แยก OS/Browser จาก user-agent string (pure function — ใช้ฝั่ง server ได้)
 * ใช้เทียบ "UA จริงจาก header (server)" กับ "อุปกรณ์ที่ client อ้าง"
 * เพื่อจับการปลอมแปลง device signals (เช่น client บอกว่าเป็น iOS แต่ header เป็น Windows)
 */
export function osFromUA(ua: string): string {
  if (/windows/i.test(ua)) return 'Windows'
  if (/android/i.test(ua)) return 'Android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS'
  if (/mac os x/i.test(ua)) return 'macOS'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Unknown'
}

export function browserFromUA(ua: string): string {
  if (/edg/i.test(ua)) return 'Edge'
  if (/opr|opera/i.test(ua)) return 'Opera'
  if (/chrome|crios/i.test(ua)) return 'Chrome'
  if (/firefox|fxios/i.test(ua)) return 'Firefox'
  if (/safari/i.test(ua)) return 'Safari'
  return 'Unknown'
}

/**
 * คืน true ถ้า OS ที่ client อ้าง ไม่ตรงกับ UA จริงจาก header
 * (สัญญาณว่ามีการปลอม device signals เพื่อหลบการตรวจอุปกรณ์ใหม่)
 */
export function isDeviceClaimInconsistent(
  headerUA: string | null,
  claimedOs?: string,
  claimedBrowser?: string
): boolean {
  if (!headerUA) return false
  const realOs = osFromUA(headerUA)
  const realBrowser = browserFromUA(headerUA)
  // เทียบเฉพาะเมื่อทั้งสองฝั่งระบุได้ชัด (เลี่ยง false positive จาก Unknown)
  if (claimedOs && realOs !== 'Unknown' && claimedOs !== 'Unknown' && claimedOs !== realOs) {
    return true
  }
  if (claimedBrowser && realBrowser !== 'Unknown' && claimedBrowser !== 'Unknown' && claimedBrowser !== realBrowser) {
    return true
  }
  return false
}
