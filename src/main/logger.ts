import { app } from 'electron'
import { appendFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const RETENTION_DAYS = 14
const IS_DEV = process.env.NODE_ENV === 'development'
let logsDir: string | null = null
let cleaned = false

function localDate(d = new Date()): string { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
function getLogsDir(): string { if (!logsDir) { logsDir = join(app.getPath('userData'), 'logs'); mkdirSync(logsDir, { recursive: true }) } return logsDir }
function cleanupOldLogs(dir: string): void {
  if (cleaned) return
  cleaned = true
  const cutoff = localDate(new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000))
  try { readdirSync(dir).filter((f) => f.endsWith('.log') && f.slice(0, 10) < cutoff).forEach((f) => unlinkSync(join(dir, f))) } catch { /* best effort */ }
}
function serialize(arg: unknown): string {
  if (arg instanceof Error) return `${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`
  if (typeof arg === 'string') return arg
  try { return JSON.stringify(arg) } catch { return String(arg) }
}

// File logger สำหรับ debug เครื่องหน้างาน — ห้าม throw เด็ดขาด ไม่งั้น kiosk ล่ม
export function log(scope: string, ...args: unknown[]): void {
  const line = `${new Date().toISOString()} [${scope}] ${args.map(serialize).join(' ')}`
  if (IS_DEV) console.log(line)
  try { const dir = getLogsDir(); cleanupOldLogs(dir); appendFileSync(join(dir, `${localDate()}.log`), line + '\n') } catch { /* never break the app over logging */ }
}
export function logError(scope: string, ...args: unknown[]): void { log(`${scope}:error`, ...args); if (!IS_DEV) console.error(`[${scope}]`, ...args) }
