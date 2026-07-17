import { describe, expect, it } from 'vitest'
import { determineKind, formatGreeting, isWithinCooldown, parseCooldownMs, parseExitAfterHour, DEFAULT_GREETING_ENTRY } from '../scan-logic'

const at = (hour: number, minute = 0): Date => { const d = new Date(2026, 6, 16); d.setHours(hour, minute, 0, 0); return d }

describe('determineKind', () => {
  it('role entry → entry เสมอ', () => { expect(determineKind('entry', at(16), 10)).toBe('entry') })
  it('role exit → exit เสมอ', () => { expect(determineKind('exit', at(7), 10)).toBe('exit') })
  it('both: แตะก่อนเวลาตัด → entry', () => { expect(determineKind('both', at(7, 30), 10)).toBe('entry') })
  it('both: แตะหลังเวลาตัด → exit', () => { expect(determineKind('both', at(15), 10)).toBe('exit') })
  it('both: แตะตรงชั่วโมงเกณฑ์พอดี → exit', () => { expect(determineKind('both', at(10), 10)).toBe('exit') })
  it('both: ปิดเกณฑ์เวลา (null) → entry แม้แตะเย็น', () => { expect(determineKind('both', at(17), null)).toBe('entry') })
})

describe('parseExitAfterHour', () => {
  it('ค่าปกติ', () => { expect(parseExitAfterHour('14')).toBe(14) })
  it('ค่าว่าง = ปิดเกณฑ์', () => { expect(parseExitAfterHour('')).toBeNull(); expect(parseExitAfterHour(undefined)).toBeNull() })
  it('ค่าเพี้ยน → fallback 10', () => { expect(parseExitAfterHour('abc')).toBe(10); expect(parseExitAfterHour('25')).toBe(10); expect(parseExitAfterHour('-1')).toBe(10) })
})

describe('isWithinCooldown', () => {
  it('ภายใน cooldown → true', () => { expect(isWithinCooldown(at(8).toISOString(), at(8, 10), 30 * 60000)).toBe(true) })
  it('พ้น cooldown → false', () => { expect(isWithinCooldown(at(8).toISOString(), at(8, 31), 30 * 60000)).toBe(false) })
  it('นาฬิกาถอยหลัง (last scan อยู่อนาคต) → false ไม่ block ถาวร', () => { expect(isWithinCooldown(at(9).toISOString(), at(8), 30 * 60000)).toBe(false) })
  it('cooldown 0 = ปิด', () => { expect(isWithinCooldown(at(8).toISOString(), at(8, 0), 0)).toBe(false) })
})

describe('parseCooldownMs', () => {
  it('ค่าปกติ', () => { expect(parseCooldownMs('15')).toBe(15 * 60000) })
  it('ค่าเพี้ยน → default 30 นาที', () => { expect(parseCooldownMs('abc')).toBe(30 * 60000); expect(parseCooldownMs('-5')).toBe(30 * 60000); expect(parseCooldownMs(undefined)).toBe(30 * 60000) })
})

describe('formatGreeting', () => {
  it('แทน {name} ใน template', () => { expect(formatGreeting('สวัสดีน้อง{name} ยินดีต้อนรับ', DEFAULT_GREETING_ENTRY, 'ต้นกล้า')).toBe('สวัสดีน้องต้นกล้า ยินดีต้อนรับ') })
  it('template ว่าง → ใช้ fallback', () => { expect(formatGreeting('', DEFAULT_GREETING_ENTRY, 'ใบเตย')).toBe('สวัสดีน้องใบเตย') })
  it('template ไม่มี {name} → ไม่พัง', () => { expect(formatGreeting('ยินดีต้อนรับ', DEFAULT_GREETING_ENTRY, 'x')).toBe('ยินดีต้อนรับ') })
})
