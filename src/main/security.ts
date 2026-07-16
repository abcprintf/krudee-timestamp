import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { deleteConfigValue, getConfigValue, setConfigValue } from './config'
import { log } from './logger'

export function hashPin(pin: string): string { const salt = randomBytes(16); return `s1:${salt.toString('hex')}:${scryptSync(pin, salt, 32).toString('hex')}` }
export function verifyPinHash(pin: string, stored: string | undefined): boolean {
  if (!stored) return false
  const [version, saltHex, hashHex] = stored.split(':')
  if (version !== 's1' || !saltHex || !hashHex) return false
  try {
    const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), 32)
    const expected = Buffer.from(hashHex, 'hex')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch { return false }
}

// เครื่องเก่าเก็บ PIN เป็น plain text — แปลงเป็น hash แล้วลบของเดิมทิ้ง
export function migratePlaintextPin(): void {
  const plain = getConfigValue('admin_pin')
  if (!plain) return
  if (!getConfigValue('admin_pin_hash')) setConfigValue('admin_pin_hash', hashPin(plain))
  deleteConfigValue('admin_pin')
  log('security', 'migrated plaintext admin_pin to hash')
}

// กันเดา PIN รัวๆ: พลาดเกิน MAX_ATTEMPTS ติดกัน → ล็อก LOCK_MS
const MAX_ATTEMPTS = 5
const LOCK_MS = 30 * 1000
let failedAttempts = 0
let lockedUntil = 0

export function pinLockRemainingMs(now = Date.now()): number { return Math.max(0, lockedUntil - now) }
export function recordPinAttempt(ok: boolean, now = Date.now()): void {
  if (ok) { failedAttempts = 0; lockedUntil = 0; return }
  failedAttempts += 1
  if (failedAttempts >= MAX_ATTEMPTS) { lockedUntil = now + LOCK_MS; failedAttempts = 0; log('security', 'PIN locked after repeated failures') }
}
