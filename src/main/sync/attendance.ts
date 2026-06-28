import { apiFetch } from '../api/client'
import { getDb } from '../db/client'
import { getConfig } from '../config'

const log = (...args: unknown[]) => { if (process.env.NODE_ENV === 'development') console.log('[sync]', ...args) }

interface PendingScanEvent { id: number; client_event_id: string; rfid_uid: string; kind: 'entry' | 'exit'; scanned_at: string }
interface SyncResponse { accepted?: string[] | number; duplicates?: string[] | number; unknown_uids?: string[] }

export function getUnsyncedCount(): number {
  return (getDb().prepare('SELECT COUNT(*) AS count FROM scan_events WHERE synced = 0').get() as { count: number }).count
}

export async function syncAttendance(): Promise<{ sent: number; synced: number; unknown: number }> {
  const db = getDb()
  const events = db.prepare(`SELECT id, client_event_id, rfid_uid, kind, scanned_at FROM scan_events WHERE synced = 0 ORDER BY scanned_at ASC LIMIT 100`).all() as PendingScanEvent[]
  if (events.length === 0) { log('คิวว่าง ไม่ส่ง request'); return { sent: 0, synced: 0, unknown: 0 } }
  const url = `${getConfig().base_url}/api/device/attendance/sync`
  log(`ส่ง ${events.length} รายการ → ${url}`, events.map((e) => ({ uid: e.rfid_uid, kind: e.kind })))
  try {
    const response = await apiFetch<SyncResponse>('/api/device/attendance/sync', { method: 'POST', body: { events: events.map(({ client_event_id, rfid_uid, kind, scanned_at }) => ({ client_event_id, rfid_uid, kind, scanned_at })) } })
    log('response ←', response)
    const markSynced = db.prepare('UPDATE scan_events SET synced = 1, sync_error = NULL WHERE id = ?')
    db.transaction(() => events.forEach((event) => markSynced.run(event.id)))()
    log(`mark synced ${events.length} รายการ ✓`)
    return { sent: events.length, synced: events.length, unknown: 0 }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'network_error'
    log('error ✗', message)
    const stmt = db.prepare('UPDATE scan_events SET sync_error = ? WHERE id = ?')
    db.transaction(() => events.forEach((event) => stmt.run(message, event.id)))()
    return { sent: events.length, synced: 0, unknown: 0 }
  }
}
