import { apiFetch } from '../api/client'
import { getDb } from '../db/client'

interface PendingScanEvent { id: number; client_event_id: string; rfid_uid: string; kind: 'entry' | 'exit'; scanned_at: string }
interface SyncResponse { accepted?: string[] | number; duplicates?: string[] | number; unknown_uids?: string[] }

export function getUnsyncedCount(): number {
  return (getDb().prepare('SELECT COUNT(*) AS count FROM scan_events WHERE synced = 0').get() as { count: number }).count
}

export async function syncAttendance(): Promise<{ sent: number; synced: number; unknown: number }> {
  const db = getDb()
  const events = db.prepare(`SELECT id, client_event_id, rfid_uid, kind, scanned_at FROM scan_events WHERE synced = 0 ORDER BY scanned_at ASC LIMIT 100`).all() as PendingScanEvent[]
  if (events.length === 0) return { sent: 0, synced: 0, unknown: 0 }
  try {
    const response = await apiFetch<SyncResponse>('/api/device/attendance/sync', { method: 'POST', body: { events: events.map(({ client_event_id, rfid_uid, kind, scanned_at }) => ({ client_event_id, rfid_uid, kind, scanned_at })) } })
    const unknownUids = new Set(response.unknown_uids ?? [])
    const acceptedIds = new Set<string>()
    for (const key of ['accepted', 'duplicates'] as const) { const value = response[key]; if (Array.isArray(value)) value.forEach((id) => acceptedIds.add(id)) }
    const shouldSyncAllKnown = typeof response.accepted === 'number' || typeof response.duplicates === 'number'
    const markSynced = db.prepare('UPDATE scan_events SET synced = 1, sync_error = NULL WHERE id = ?')
    const markUnknown = db.prepare('UPDATE scan_events SET sync_error = ? WHERE id = ?')
    db.transaction(() => events.forEach((event) => unknownUids.has(event.rfid_uid) ? markUnknown.run('unknown_uid', event.id) : (shouldSyncAllKnown || acceptedIds.has(event.client_event_id)) && markSynced.run(event.id)))()
    return { sent: events.length, synced: events.filter((event) => !unknownUids.has(event.rfid_uid)).length, unknown: unknownUids.size }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'network_error'
    const stmt = db.prepare('UPDATE scan_events SET sync_error = ? WHERE id = ?')
    db.transaction(() => events.forEach((event) => stmt.run(message, event.id)))()
    return { sent: events.length, synced: 0, unknown: 0 }
  }
}
