import { apiFetch } from '../api/client'
import { getDb } from '../db/client'
import { getConfig } from '../config'
import { log, logError } from '../logger'
import { partitionSyncResponse, type SyncResponse } from './response'

interface PendingScanEvent { id: number; client_event_id: string; rfid_uid: string; kind: 'entry' | 'exit'; scanned_at: string }

export function getUnsyncedCount(): number {
  return (getDb().prepare('SELECT COUNT(*) AS count FROM scan_events WHERE synced = 0').get() as { count: number }).count
}

export async function syncAttendance(): Promise<{ sent: number; synced: number; rejected: number }> {
  const db = getDb()
  const events = db.prepare(`SELECT id, client_event_id, rfid_uid, kind, scanned_at FROM scan_events WHERE synced = 0 ORDER BY scanned_at ASC LIMIT 100`).all() as PendingScanEvent[]
  if (events.length === 0) return { sent: 0, synced: 0, rejected: 0 }
  log('sync', `ส่ง ${events.length} รายการ → ${getConfig().base_url}/api/device/attendance/sync`)
  try {
    const response = await apiFetch<SyncResponse>('/api/device/attendance/sync', { method: 'POST', body: { events: events.map(({ client_event_id, rfid_uid, kind, scanned_at }) => ({ client_event_id, rfid_uid, kind, scanned_at })) } })
    const { synced, rejected } = partitionSyncResponse(events.map((e) => e.client_event_id), response)
    const markSynced = db.prepare('UPDATE scan_events SET synced = 1, sync_error = NULL WHERE client_event_id = ?')
    const markRejected = db.prepare(`UPDATE scan_events SET sync_error = 'rejected_by_server' WHERE client_event_id = ?`)
    db.transaction(() => { synced.forEach((id) => markSynced.run(id)); rejected.forEach((id) => markRejected.run(id)) })()
    if (rejected.length > 0) logError('sync', `เซิร์ฟเวอร์ไม่รับ ${rejected.length} รายการ`, rejected)
    log('sync', `synced ${synced.length}/${events.length} รายการ ✓`)
    return { sent: events.length, synced: synced.length, rejected: rejected.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'network_error'
    logError('sync', message)
    const stmt = db.prepare('UPDATE scan_events SET sync_error = ? WHERE id = ?')
    db.transaction(() => events.forEach((event) => stmt.run(message, event.id)))()
    return { sent: events.length, synced: 0, rejected: 0 }
  }
}
