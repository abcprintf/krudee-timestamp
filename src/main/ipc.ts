import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { triggerInstall } from './updater'
import { apiFetch, registerDevice } from './api/client'
import { clearDeviceConfig, getConfig, getSafeConfig, isConfigured, setConfigValue, setConfigValues } from './config'
import { getDb } from './db/client'
import { setAutoLaunch } from './auto-launch'
import { getUnsyncedCount } from './sync/attendance'
import { getClockSkew, scheduleSyncSoon, syncNow } from './sync/scheduler'
import { syncRoster } from './sync/roster'
import { speak } from './tts'
import { initRfidDeviceMonitor, getRfidDeviceStatus } from './rfid-device'
import { hashPin, migratePlaintextPin, pinLockRemainingMs, recordPinAttempt, verifyPinHash } from './security'
import { determineKind, formatGreeting, isWithinCooldown, parseCooldownMs, parseExitAfterHour, DEFAULT_GREETING_ENTRY, DEFAULT_GREETING_EXIT, type KioskRole, type ScanKind } from './scan-logic'
import { logError } from './logger'

interface SetupPayload { base_url: string; school_code: string; setup_token: string; device_name?: string; role: KioskRole; admin_pin: string }
interface ScanPayload { uid: string; scanned_at?: string }
interface StudentRow { id: string; student_code: string | null; prefix: string | null; first_name: string; last_name: string; nickname: string | null; photo_url: string | null; photo_local_path: string | null; classroom_name: string | null; class_number: number | null; rfid_uids: string | null; rfid_cards: string | null; updated_at: string | null }

function parseUids(value: string | null): string[] { try { const parsed = value ? JSON.parse(value) : []; return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [] } catch { return [] } }
type CardObject = { id: string; rfid_uid: string; label: string | null }
function parseCards(raw: string | null): CardObject[] { try { return raw ? JSON.parse(raw) : [] } catch { return [] } }
function toStudent(row: StudentRow): StudentRow & { rfid_uids_list: string[]; rfid_cards_list: CardObject[] } { return { ...row, rfid_uids_list: parseUids(row.rfid_uids), rfid_cards_list: parseCards(row.rfid_cards) } }
function findStudentByUid(uid: string): StudentRow | null {
  // exact match ผ่าน json_each — ไม่โดน substring ชนกันแบบ LIKE และไม่ต้อง escape % _
  try { return getDb().prepare(`SELECT s.* FROM students s, json_each(COALESCE(s.rfid_uids, '[]')) j WHERE j.value = ? LIMIT 1`).get(uid) as StudentRow | null ?? null }
  catch { const rows = getDb().prepare('SELECT * FROM students WHERE rfid_uids LIKE ?').all(`%${uid}%`) as StudentRow[]; return rows.find((row) => parseUids(row.rfid_uids).includes(uid)) ?? null }
}
function findStudentByCode(code: string): StudentRow | null { return getDb().prepare('SELECT * FROM students WHERE student_code = ?').get(code.trim()) as StudentRow | null ?? null }

function findLastScanToday(studentId: string, scannedAt: Date): { kind: ScanKind; scanned_at: string } | null {
  const dayStart = new Date(scannedAt); dayStart.setHours(0, 0, 0, 0)
  return getDb().prepare(`SELECT kind, scanned_at FROM scan_events WHERE matched_student_id = ? AND scanned_at >= ? ORDER BY scanned_at DESC LIMIT 1`).get(studentId, dayStart.toISOString()) as { kind: ScanKind; scanned_at: string } | null
}
function greeting(kind: ScanKind, student: StudentRow): string {
  const name = student.nickname || student.first_name
  const config = getConfig()
  return kind === 'entry' ? formatGreeting(config.greeting_entry, DEFAULT_GREETING_ENTRY, name) : formatGreeting(config.greeting_exit, DEFAULT_GREETING_EXIT, name)
}

// เฉพาะ key ที่ Admin UI แก้ได้ — กัน renderer เขียนทับ device_token / admin_pin_hash
const ALLOWED_SETTINGS = ['base_url', 'device_name', 'role', 'tts_enabled', 'auto_start', 'exit_after_hour', 'late_after', 'scan_cooldown_minutes', 'greeting_entry', 'greeting_exit', 'kiosk_lock'] as const

export function registerIpcHandlers(): void {
  migratePlaintextPin()
  initRfidDeviceMonitor()
  ipcMain.handle('device:rfid-status', () => getRfidDeviceStatus())
  ipcMain.handle('device:clock-skew', () => getClockSkew())
  ipcMain.handle('config:get', () => ({ ...getSafeConfig(), configured: isConfigured() }))
  ipcMain.handle('setup:register', async (_event, payload: SetupPayload) => {
    setConfigValues({ base_url: payload.base_url || 'http://localhost:3000', school_code: payload.school_code, device_name: payload.device_name, role: payload.role, admin_pin_hash: hashPin(payload.admin_pin), app_version: app.getVersion() })
    const result = await registerDevice({ school_code: payload.school_code, setup_token: payload.setup_token, device_name: payload.device_name, app_version: app.getVersion() })
    setConfigValues({ device_id: result.device_id, device_token: result.device_token, tts_enabled: 'true', auto_start: 'false' })
    const school = result.school as { id?: string; code?: string; name?: string } | null
    if (school) setConfigValues({ school_id: school.id ?? undefined, school_name: school.name ?? undefined })
    await syncRoster()
    return { ok: true, device_id: result.device_id, school: result.school }
  })
  ipcMain.handle('scan:record', async (_event, payload: ScanPayload) => {
    const uid = (payload.uid ?? '').trim()
    const scannedAt = payload.scanned_at ? new Date(payload.scanned_at) : new Date()
    // Try RFID UID first, fall back to student_code lookup for manual entry
    let student = findStudentByUid(uid)
    if (!student) student = findStudentByCode(uid)

    const config = getConfig()
    const kind = determineKind(config.role, scannedAt, parseExitAfterHour(config.exit_after_hour))

    // Duplicate guard: บล็อกเฉพาะแตะซ้ำ kind เดียวกันภายใน cooldown (เข้า→ออก บันทึกได้ทันที)
    if (student) {
      const last = findLastScanToday(student.id, scannedAt)
      if (last && last.kind === kind && isWithinCooldown(last.scanned_at, scannedAt, parseCooldownMs(config.scan_cooldown_minutes))) {
        return { ok: true, duplicate: true, event: { client_event_id: '', rfid_uid: uid, scanned_at: scannedAt.toISOString(), kind: last.kind }, student: toStudent(student), queue_count: getUnsyncedCount() }
      }
    }

    const clientEventId = randomUUID()
    getDb().prepare(`INSERT INTO scan_events (client_event_id, rfid_uid, scanned_at, kind, matched_student_id) VALUES (?, ?, ?, ?, ?)`).run(clientEventId, uid, scannedAt.toISOString(), kind, student?.id ?? null)
    if (student) void speak(greeting(kind, student))
    scheduleSyncSoon() // ส่งขึ้นเซิร์ฟเวอร์ภายในไม่กี่วินาที ไม่ต้องรอ cron 5 นาที
    return { ok: true, event: { client_event_id: clientEventId, rfid_uid: uid, scanned_at: scannedAt.toISOString(), kind }, student: student ? toStudent(student) : null, queue_count: getUnsyncedCount() }
  })
  ipcMain.handle('scan:queue-count', () => getUnsyncedCount())
  ipcMain.handle('scan:history', () => {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    return getDb().prepare(`SELECT se.id, se.rfid_uid, se.scanned_at, se.kind, s.prefix, s.first_name, s.last_name, s.nickname, s.classroom_name, s.class_number, s.photo_url, s.photo_local_path FROM scan_events se LEFT JOIN students s ON s.id = se.matched_student_id WHERE se.scanned_at >= ? ORDER BY se.scanned_at DESC LIMIT 10`).all(dayStart.toISOString())
  })
  ipcMain.handle('sync:now', () => syncNow())
  ipcMain.handle('roster:sync', () => syncRoster())
  ipcMain.handle('admin:verify-pin', (_event, pin: string) => {
    const lockedMs = pinLockRemainingMs()
    if (lockedMs > 0) return { ok: false, locked: true, retry_in_s: Math.ceil(lockedMs / 1000) }
    const ok = verifyPinHash(String(pin ?? ''), getConfig().admin_pin_hash)
    recordPinAttempt(ok)
    const lockAfter = pinLockRemainingMs()
    return { ok, locked: lockAfter > 0, retry_in_s: lockAfter > 0 ? Math.ceil(lockAfter / 1000) : 0 }
  })
  ipcMain.handle('admin:students', (_event, query = '') => { const q = `%${String(query).trim()}%`; return (getDb().prepare(`SELECT * FROM students WHERE first_name LIKE ? OR last_name LIKE ? OR nickname LIKE ? OR student_code LIKE ? OR classroom_name LIKE ? ORDER BY classroom_name, class_number, first_name LIMIT 300`).all(q, q, q, q, q) as StudentRow[]).map(toStudent) })
  ipcMain.handle('admin:unknown-uids', () => getDb().prepare(`SELECT rfid_uid, COUNT(*) AS count, MAX(scanned_at) AS last_scanned_at FROM scan_events WHERE matched_student_id IS NULL GROUP BY rfid_uid ORDER BY last_scanned_at DESC`).all())
  ipcMain.handle('admin:daily-summary', () => {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    const lateAfter = getConfig().late_after || '08:30'
    const [lateHour, lateMinute] = lateAfter.split(':').map(Number)
    const lateThreshold = new Date(dayStart); lateThreshold.setHours(Number.isFinite(lateHour) ? lateHour : 8, Number.isFinite(lateMinute) ? lateMinute : 0, 0, 0)
    const rows = getDb().prepare(`SELECT s.id, s.classroom_name, MIN(CASE WHEN se.kind = 'entry' THEN se.scanned_at END) AS first_entry, MAX(CASE WHEN se.kind = 'exit' THEN se.scanned_at END) AS last_exit
      FROM scan_events se JOIN students s ON s.id = se.matched_student_id WHERE se.scanned_at >= ? GROUP BY s.id`).all(dayStart.toISOString()) as Array<{ id: string; classroom_name: string | null; first_entry: string | null; last_exit: string | null }>
    const classTotals = getDb().prepare(`SELECT COALESCE(classroom_name, 'ไม่ระบุห้อง') AS classroom_name, COUNT(*) AS total FROM students GROUP BY COALESCE(classroom_name, 'ไม่ระบุห้อง') ORDER BY classroom_name`).all() as Array<{ classroom_name: string; total: number }>
    const byClass = new Map(classTotals.map((c) => [c.classroom_name, { classroom_name: c.classroom_name, total: c.total, present: 0, late: 0, exited: 0 }]))
    let present = 0, late = 0, exited = 0
    rows.forEach((row) => {
      const cls = byClass.get(row.classroom_name ?? 'ไม่ระบุห้อง')
      present += 1; if (cls) cls.present += 1
      if (row.first_entry && new Date(row.first_entry).getTime() > lateThreshold.getTime()) { late += 1; if (cls) cls.late += 1 }
      if (row.last_exit) { exited += 1; if (cls) cls.exited += 1 }
    })
    const totalStudents = (getDb().prepare('SELECT COUNT(*) AS count FROM students').get() as { count: number }).count
    return { late_after: lateAfter, totals: { students: totalStudents, present, late, exited, absent: Math.max(0, totalStudents - present) }, classes: [...byClass.values()] }
  })
  ipcMain.handle('admin:bind-card', async (_event, payload: { student_id: string; rfid_uid: string; label?: string }) => {
    try {
      await apiFetch('/api/device/cards/bind', { method: 'POST', body: payload })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      logError('bind-card', msg)
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
      logError('unbind-card', msg)
      if (msg.includes('404')) throw new Error('ไม่พบข้อมูลบัตรในระบบ กรุณาซิงก์ข้อมูลใหม่')
      throw new Error('ยกเลิกบัตรไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ KruDee')
    }
    await syncRoster()
    return { ok: true }
  })
  ipcMain.handle('admin:clear-unknown-uids', () => { getDb().prepare('DELETE FROM scan_events WHERE matched_student_id IS NULL').run(); return { ok: true } })
  ipcMain.handle('admin:delete-unknown-uid', (_event, uid: string) => { getDb().prepare('DELETE FROM scan_events WHERE rfid_uid = ? AND matched_student_id IS NULL').run(uid); return { ok: true } })
  ipcMain.handle('admin:settings:update', async (_event, payload: Partial<Record<string, string>>) => {
    const values = Object.fromEntries(ALLOWED_SETTINGS.filter((key) => typeof payload[key] === 'string').map((key) => [key, payload[key] as string]))
    setConfigValues(values)
    if (typeof payload.new_pin === 'string' && payload.new_pin.length >= 4) setConfigValue('admin_pin_hash', hashPin(payload.new_pin))
    if (typeof payload.auto_start === 'string') await setAutoLaunch(payload.auto_start === 'true')
    if (typeof payload.kiosk_lock === 'string') BrowserWindow.getAllWindows().forEach((win) => win.setKiosk(payload.kiosk_lock === 'true'))
    return { ...getSafeConfig(), configured: isConfigured() }
  })
  ipcMain.handle('admin:history', () => getDb().prepare(`SELECT scan_events.*, students.first_name, students.last_name, students.nickname, students.classroom_name FROM scan_events LEFT JOIN students ON students.id = scan_events.matched_student_id ORDER BY scan_events.scanned_at DESC LIMIT 100`).all())
  ipcMain.handle('admin:reset-device', () => { clearDeviceConfig(); getDb().prepare('DELETE FROM students').run(); getDb().prepare('DELETE FROM scan_events').run(); setConfigValue('base_url', 'http://localhost:3000'); return { ok: true } })
  ipcMain.handle('dev:clear-scans', () => {
    if (app.isPackaged) return { ok: false, error: 'not allowed in production' }
    getDb().prepare('DELETE FROM scan_events').run()
    return { ok: true }
  })
  ipcMain.handle('updater:install', () => {
    if (process.platform === 'linux' && !process.execPath.endsWith('.AppImage')) {
      shell.openExternal('https://github.com/abcprintf/krudee-timestamp/releases/latest')
      return
    }
    triggerInstall()
  })
}
