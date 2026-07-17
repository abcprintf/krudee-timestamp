// Pure scan rules — ห้าม import electron/db เพื่อให้ unit test ได้ตรงๆ
export type KioskRole = 'entry' | 'exit' | 'both'
export type ScanKind = 'entry' | 'exit'

export const DEFAULT_COOLDOWN_MINUTES = 30
export const DEFAULT_EXIT_AFTER_HOUR = 10
export const DEFAULT_GREETING_ENTRY = 'สวัสดีน้อง{name}'
export const DEFAULT_GREETING_EXIT = 'เดินทางกลับบ้านปลอดภัยนะคะน้อง{name}'

export function parseCooldownMs(value: string | undefined): number {
  const minutes = Number(value)
  return Number.isFinite(minutes) && minutes >= 0 ? minutes * 60 * 1000 : DEFAULT_COOLDOWN_MINUTES * 60 * 1000
}

export function parseExitAfterHour(value: string | undefined): number | null {
  if (value === '' || value === undefined) return null // ค่าว่าง = ปิดเกณฑ์เวลา (entry เสมอถ้ายังไม่มี entry)
  const hour = Number(value)
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_EXIT_AFTER_HOUR
}

export function isWithinCooldown(lastScannedAt: string, scannedAt: Date, cooldownMs: number): boolean {
  const msSinceLast = scannedAt.getTime() - new Date(lastScannedAt).getTime()
  return msSinceLast >= 0 && msSinceLast < cooldownMs
}

// กติกาโหมด both: อิงเวลาล้วน — ก่อน exit_after_hour = entry, ตั้งแต่นั้นไป = exit
// (คู่กับ cooldown guard ที่บล็อกเฉพาะแตะซ้ำ kind เดิม — เปลี่ยน kind บันทึกได้ทันที)
export function determineKind(role: KioskRole, scannedAt: Date, exitAfterHour: number | null): ScanKind {
  if (role === 'entry') return 'entry'
  if (role === 'exit') return 'exit'
  if (exitAfterHour !== null && scannedAt.getHours() >= exitAfterHour) return 'exit'
  return 'entry'
}

export function formatGreeting(template: string | undefined, fallback: string, name: string): string {
  const t = template?.trim() ? template : fallback
  return t.replaceAll('{name}', name)
}
