import { app, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { apiFetch, registerDevice } from './api/client'
import { clearDeviceConfig, getConfig, isConfigured, setConfigValue, setConfigValues, type KioskRole } from './config'
import { getDb } from './db/client'
import { setAutoLaunch } from './auto-launch'
import { getUnsyncedCount } from './sync/attendance'
import { syncNow } from './sync/scheduler'
import { syncRoster } from './sync/roster'
import { speak } from './tts'

interface SetupPayload { base_url: string; school_code: string; setup_token: string; device_name?: string; role: KioskRole; admin_pin: string }
interface ScanPayload { uid: string; scanned_at?: string }
interface StudentRow { id: string; student_code: string | null; prefix: string | null; first_name: string; last_name: string; nickname: string | null; photo_url: string | null; photo_local_path: string | null; classroom_name: string | null; class_number: number | null; rfid_uids: string | null; rfid_cards: string | null; updated_at: string | null }

function parseUids(value: string | null): string[] { try { const parsed = value ? JSON.parse(value) : []; return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [] } catch { return [] } }
type CardObject = { id: string; rfid_uid: string; label: string | null }
function parseCards(raw: string | null): CardObject[] { try { return raw ? JSON.parse(raw) : [] } catch { return [] } }
function toStudent(row: StudentRow): StudentRow & { rfid_uids_list: string[]; rfid_cards_list: CardObject[] } { return { ...row, rfid_uids_list: parseUids(row.rfid_uids), rfid_cards_list: parseCards(row.rfid_cards) } }
function findStudentByUid(uid: string): StudentRow | null { const rows = getDb().prepare('SELECT * FROM students WHERE rfid_uids LIKE ?').all(`%${uid}%`) as StudentRow[]; return rows.find((row) => parseUids(row.rfid_uids).includes(uid)) ?? null }
function localDayStartIso(now: Date): string { const start = new Date(now); start.setHours(0, 0, 0, 0); return start.toISOString() }
function determineKind(role: KioskRole, studentId: string | null, scannedAt: Date): 'entry' | 'exit' {
  if (role === 'entry' || role === 'exit') return role
  if (!studentId) return 'entry'
  const last = getDb().prepare(`SELECT kind FROM scan_events WHERE matched_student_id = ? AND scanned_at >= ? ORDER BY scanned_at DESC LIMIT 1`).get(studentId, localDayStartIso(scannedAt)) as { kind: 'entry' | 'exit' } | undefined
  return last?.kind === 'entry' ? 'exit' : 'entry'
}
function greeting(kind: 'entry' | 'exit', student: StudentRow): string { const name = student.nickname || student.first_name; return kind === 'entry' ? `สวัสดีน้อง${name}` : `เดินทางกลับบ้านปลอดภัยนะคะน้อง${name}` }

export function registerIpcHandlers(): void {
  ipcMain.handle('config:get', () => ({ ...getConfig(), configured: isConfigured() }))
  ipcMain.handle('setup:register', async (_event, payload: SetupPayload) => {
    setConfigValues({ base_url: payload.base_url || 'http://localhost:3000', school_code: payload.school_code, setup_token: payload.setup_token, device_name: payload.device_name, role: payload.role, admin_pin: payload.admin_pin, app_version: app.getVersion() })
    const result = await registerDevice({ school_code: payload.school_code, setup_token: payload.setup_token, device_name: payload.device_name, app_version: app.getVersion() })
    setConfigValues({ device_id: result.device_id, device_token: result.device_token, tts_enabled: 'true', auto_start: 'false' })
    await syncRoster()
    return { ok: true, device_id: result.device_id, school: result.school }
  })
  ipcMain.handle('scan:record', async (_event, payload: ScanPayload) => {
    const uid = payload.uid.trim()
    const scannedAt = payload.scanned_at ? new Date(payload.scanned_at) : new Date()
    const student = findStudentByUid(uid)
    const kind = determineKind(getConfig().role, student?.id ?? null, scannedAt)
    const clientEventId = randomUUID()
    getDb().prepare(`INSERT INTO scan_events (client_event_id, rfid_uid, scanned_at, kind, matched_student_id) VALUES (?, ?, ?, ?, ?)`).run(clientEventId, uid, scannedAt.toISOString(), kind, student?.id ?? null)
    if (student) void speak(greeting(kind, student))
    return { ok: true, event: { client_event_id: clientEventId, rfid_uid: uid, scanned_at: scannedAt.toISOString(), kind }, student: student ? toStudent(student) : null, queue_count: getUnsyncedCount() }
  })
  ipcMain.handle('scan:queue-count', () => getUnsyncedCount())
  ipcMain.handle('sync:now', () => syncNow())
  ipcMain.handle('roster:sync', () => syncRoster())
  ipcMain.handle('admin:verify-pin', (_event, pin: string) => pin === getConfig().admin_pin)
  ipcMain.handle('admin:students', (_event, query = '') => { const q = `%${String(query).trim()}%`; return (getDb().prepare(`SELECT * FROM students WHERE first_name LIKE ? OR last_name LIKE ? OR nickname LIKE ? OR student_code LIKE ? OR classroom_name LIKE ? ORDER BY classroom_name, class_number, first_name LIMIT 300`).all(q, q, q, q, q) as StudentRow[]).map(toStudent) })
  ipcMain.handle('admin:unknown-uids', () => getDb().prepare(`SELECT rfid_uid, COUNT(*) AS count, MAX(scanned_at) AS last_scanned_at FROM scan_events WHERE matched_student_id IS NULL GROUP BY rfid_uid ORDER BY last_scanned_at DESC`).all())
  ipcMain.handle('admin:bind-card', async (_event, payload: { student_id: string; rfid_uid: string; label?: string }) => {
    try {
      await apiFetch('/api/device/cards/bind', { method: 'POST', body: payload })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('409')) throw new Error('บัตรนี้ถูกผูกกับนักเรียนคนอื่นในระบบแล้ว กรุณาติดต่อผู้ดูแลระบบ KruDee เพื่อแก้ไข')
      if (msg.includes('404')) throw new Error('ไม่พบข้อมูลนักเรียนในระบบ กรุณาซิงก์ข้อมูลใหม่')
      throw new Error('ผูกบัตรไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและติดต่อผู้ดูแลระบบ KruDee')
    }
    await syncRoster()
    getDb().prepare('UPDATE scan_events SET matched_student_id = ? WHERE rfid_uid = ?').run(payload.student_id, payload.rfid_uid)
    return { ok: true }
  })
  ipcMain.handle('admin:unbind-card', async (_event, payload: { card_id: string }) => {
    try { await apiFetch('/api/device/cards/unbind', { method: 'POST', body: payload }) }
    catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('404')) throw new Error('ไม่พบข้อมูลบัตรในระบบ กรุณาซิงก์ข้อมูลใหม่')
      throw new Error('ยกเลิกบัตรไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ KruDee')
    }
    await syncRoster()
    return { ok: true }
  })
  ipcMain.handle('admin:clear-unknown-uids', () => { getDb().prepare('DELETE FROM scan_events WHERE matched_student_id IS NULL').run(); return { ok: true } })
  ipcMain.handle('admin:delete-unknown-uid', (_event, uid: string) => { getDb().prepare('DELETE FROM scan_events WHERE rfid_uid = ? AND matched_student_id IS NULL').run(uid); return { ok: true } })
  ipcMain.handle('admin:settings:update', async (_event, payload: Partial<Record<string, string>>) => { setConfigValues(payload); if (typeof payload.auto_start === 'string') await setAutoLaunch(payload.auto_start === 'true'); return getConfig() })
  ipcMain.handle('admin:history', () => getDb().prepare(`SELECT scan_events.*, students.first_name, students.last_name, students.nickname, students.classroom_name FROM scan_events LEFT JOIN students ON students.id = scan_events.matched_student_id ORDER BY scan_events.scanned_at DESC LIMIT 100`).all())
  ipcMain.handle('admin:reset-device', () => { clearDeviceConfig(); getDb().prepare('DELETE FROM students').run(); getDb().prepare('DELETE FROM scan_events').run(); setConfigValue('base_url', 'http://localhost:3000'); return { ok: true } })
}
