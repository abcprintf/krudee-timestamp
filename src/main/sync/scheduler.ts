import cron, { ScheduledTask } from 'node-cron'
import { app } from 'electron'
import { apiFetchRaw } from '../api/client'
import { getConfig, isConfigured, setConfigValue } from '../config'
import { getDb } from '../db/client'
import { log, logError } from '../logger'
import { syncAttendance } from './attendance'
import { syncRoster } from './roster'

const PRUNE_AFTER_DAYS = 90
let syncTask: ScheduledTask | null = null
let rosterTask: ScheduledTask | null = null
let pruneTask: ScheduledTask | null = null
let running = false
let syncSoonTimer: NodeJS.Timeout | null = null
let clockSkew: { skew_ms: number; checked_at: string } | null = null

export function startScheduler(): void {
  if (syncTask) return
  syncTask = cron.schedule('*/5 * * * *', () => { void syncNow() })
  rosterTask = cron.schedule('*/30 * * * *', () => { if (isConfigured()) void syncRoster().catch((error) => logError('roster', error)) })
  pruneTask = cron.schedule('0 3 * * *', () => pruneOldEvents())
  pruneOldEvents()
}
export function stopScheduler(): void { syncTask?.stop(); rosterTask?.stop(); pruneTask?.stop(); syncTask = null; rosterTask = null; pruneTask = null; if (syncSoonTimer) { clearTimeout(syncSoonTimer); syncSoonTimer = null } }

// เรียกหลังบันทึกสแกนใหม่ — debounce สั้นๆ เผื่อเด็กแตะติดกันเป็นแถว จะได้ส่งเป็น batch เดียว
export function scheduleSyncSoon(delayMs = 8000): void {
  if (syncSoonTimer) clearTimeout(syncSoonTimer)
  syncSoonTimer = setTimeout(() => { syncSoonTimer = null; void syncNow() }, delayMs)
}

// นาฬิกาเครื่อง kiosk เพี้ยนบ่อย — เทียบกับ Date header ของเซิร์ฟเวอร์ทุกรอบ heartbeat (ความละเอียด ~1-2 วินาที พอสำหรับเตือน)
export function getClockSkew(): { skew_ms: number; checked_at: string } | null { return clockSkew }

function pruneOldEvents(): void {
  const cutoff = new Date(Date.now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString()
  try { const { changes } = getDb().prepare('DELETE FROM scan_events WHERE synced = 1 AND scanned_at < ?').run(cutoff); if (changes > 0) log('prune', `ลบ scan_events เก่าที่ synced แล้ว ${changes} แถว`) } catch (error) { logError('prune', error) }
}

export async function syncNow(): Promise<{ attendance: Awaited<ReturnType<typeof syncAttendance>>; heartbeat: boolean }> {
  if (running || !isConfigured()) return { attendance: { sent: 0, synced: 0, rejected: 0 }, heartbeat: false }
  running = true
  try {
    const attendance = await syncAttendance()
    let heartbeat = false
    try {
      const response = await apiFetchRaw('/api/device/heartbeat', { method: 'POST', body: { app_version: getConfig().app_version ?? app.getVersion() } })
      heartbeat = true
      const serverDate = response.headers.get('date')
      if (serverDate) clockSkew = { skew_ms: Date.now() - new Date(serverDate).getTime(), checked_at: new Date().toISOString() }
      try { const body = response._data as { target_version?: string } | undefined; if (typeof body?.target_version === 'string' && body.target_version) setConfigValue('target_version', body.target_version) } catch { /* server รุ่นเก่าไม่ส่ง body — คงค่าเดิม */ }
    } catch (error) { logError('heartbeat', error) }
    return { attendance, heartbeat }
  } finally { running = false }
}
