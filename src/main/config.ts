import { getDb } from './db/client'

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
  admin_pin?: string
  role: KioskRole
  exit_after_hour: string  // "14" = 14:00, ถ้าแตะหลังเวลานี้ถือว่า exit
  scan_cooldown_minutes: string  // กันแตะซ้ำ (นาที) — ตั้งต่ำๆ ได้ตอนทดสอบ
  tts_enabled: string
  auto_start: string
  app_version?: string
}

const IS_DEV = process.env.NODE_ENV === 'development'
const DEFAULTS: AppConfig = { base_url: IS_DEV ? 'http://localhost:3000' : 'https://krudee.workitdee.com', role: 'both', exit_after_hour: '10', scan_cooldown_minutes: '30', tts_enabled: 'true', auto_start: 'false' }

export function getConfigValue(key: string): string | undefined {
  return (getDb().prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined)?.value
}

export function setConfigValue(key: string, value: string): void {
  getDb().prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
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

export function isConfigured(): boolean {
  const config = getConfig()
  return Boolean(config.device_id && config.device_token)
}

export function clearDeviceConfig(): void {
  getDb().prepare('DELETE FROM config').run()
}
