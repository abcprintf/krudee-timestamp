import cron, { ScheduledTask } from 'node-cron'
import { app } from 'electron'
import { apiFetch } from '../api/client'
import { getConfig } from '../config'
import { syncAttendance } from './attendance'
import { syncRoster } from './roster'

let syncTask: ScheduledTask | null = null
let rosterTask: ScheduledTask | null = null
let running = false

export function startScheduler(): void {
  if (syncTask) return
  syncTask = cron.schedule('*/5 * * * *', () => { void syncNow() })
  rosterTask = cron.schedule('*/30 * * * *', () => { void syncRoster().catch((error) => console.error('Roster sync failed', error)) })
}
export function stopScheduler(): void { syncTask?.stop(); rosterTask?.stop(); syncTask = null; rosterTask = null }

export async function syncNow(): Promise<{ attendance: Awaited<ReturnType<typeof syncAttendance>>; heartbeat: boolean }> {
  if (running) return { attendance: { sent: 0, synced: 0, unknown: 0 }, heartbeat: false }
  running = true
  try {
    const attendance = await syncAttendance()
    let heartbeat = false
    try { await apiFetch('/api/device/heartbeat', { method: 'POST', body: { app_version: getConfig().app_version ?? app.getVersion() } }); heartbeat = true } catch (error) { console.error('Heartbeat failed', error) }
    return { attendance, heartbeat }
  } finally { running = false }
}
