import { getDb } from './db/client'
import { DEFAULT_COOLDOWN_MINUTES, DEFAULT_EXIT_AFTER_HOUR, DEFAULT_GREETING_ENTRY, DEFAULT_GREETING_EXIT } from './scan-logic'

export type KioskRole = 'entry' | 'exit' | 'both'
export interface AppConfig {
  base_url: string
  school_code?: string
  school_id?: string
  school_name?: string
  setup_token?: string
  device_name?: string
  device_id?: string
  device_token?: string
  admin_pin?: string // legacy plain text — ถูก migrate เป็น admin_pin_hash แล้วลบทิ้ง
  admin_pin_hash?: string
  role: KioskRole
  exit_after_hour: string  // "14" = แตะครั้งแรกหลัง 14:00 ถือว่า exit, "" = ปิดเกณฑ์
  late_after: string       // "08:00" = entry แรกหลังเวลานี้ถือว่ามาสาย
  scan_cooldown_minutes: string
  greeting_entry: string   // รองรับ {name}
  greeting_exit: string
  kiosk_lock: string
  tts_enabled: string
  auto_start: string
  app_version?: string
}

const IS_DEV = process.env.NODE_ENV === 'development'
const DEFAULTS: AppConfig = {
  base_url: IS_DEV ? 'http://localhost:3000' : 'https://krudee.workitdee.com', role: 'both',
  exit_after_hour: String(DEFAULT_EXIT_AFTER_HOUR), late_after: '08:00', scan_cooldown_minutes: String(DEFAULT_COOLDOWN_MINUTES),
  greeting_entry: DEFAULT_GREETING_ENTRY, greeting_exit: DEFAULT_GREETING_EXIT,
  kiosk_lock: 'false', tts_enabled: 'true', auto_start: 'false'
}

export function getConfigValue(key: string): string | undefined {
  return (getDb().prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined)?.value
}

export function setConfigValue(key: string, value: string): void {
  getDb().prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

export function deleteConfigValue(key: string): void {
  getDb().prepare('DELETE FROM config WHERE key = ?').run(key)
}

export function setConfigValues(values: Record<string, string | undefined>): void {
  const stmt = getDb().prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  const tx = getDb().transaction((entries: Array<[string, string]>) => entries.forEach(([key, value]) => stmt.run(key, value)))
  tx(Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

export function getConfig(): AppConfig {
  const rows = getDb().prepare('SELECT key, value FROM config').all() as Array<{ key: string; value: string }>
  const saved = Object.fromEntries(rows.map((row) => [row.key, row.value])) as Partial<AppConfig>
  const role = saved.role === 'entry' || saved.role === 'exit' || saved.role === 'both' ? saved.role : DEFAULTS.role
  return { ...DEFAULTS, ...saved, role }
}

// เฉพาะ key ที่ renderer ต้องเห็น — ห้ามหลุด device_token / setup_token / admin_pin_hash เด็ดขาด
const SAFE_KEYS = ['base_url', 'school_code', 'school_name', 'device_name', 'device_id', 'role', 'exit_after_hour', 'late_after', 'scan_cooldown_minutes', 'greeting_entry', 'greeting_exit', 'kiosk_lock', 'tts_enabled', 'auto_start', 'app_version'] as const
export type SafeConfig = Pick<AppConfig, (typeof SAFE_KEYS)[number]>
export function getSafeConfig(): SafeConfig {
  const config = getConfig()
  return Object.fromEntries(SAFE_KEYS.map((key) => [key, config[key]])) as unknown as SafeConfig
}

export function isConfigured(): boolean {
  const config = getConfig()
  return Boolean(config.device_id && config.device_token)
}

export function clearDeviceConfig(): void {
  getDb().prepare('DELETE FROM config').run()
}
