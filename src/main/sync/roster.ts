import { apiFetch } from '../api/client'
import { getDb } from '../db/client'
import { deletePhotoFile, downloadStudentPhoto, hasPhotoFile } from '../photos'
import { log } from '../logger'

export interface RosterStudent {
  id: string; student_code?: string | null; prefix?: string | null; first_name: string; last_name: string; nickname?: string | null;
  photo_url?: string | null; classroom_name?: string | null; class_number?: number | null; rfid_uids?: string[];
  cards?: Array<{ rfid_uid: string; is_active?: boolean }>
  rfid_cards?: Array<{ id: string; rfid_uid: string; label?: string | null }>
  updated_at?: string | null
}

function normalizeRosterPayload(payload: unknown): RosterStudent[] {
  if (Array.isArray(payload)) return payload as RosterStudent[]
  if (payload && typeof payload === 'object' && Array.isArray((payload as { students?: unknown }).students)) return (payload as { students: RosterStudent[] }).students
  return []
}
function extractUids(student: RosterStudent): string[] {
  const fromCards = (student.rfid_cards ?? []).map(c => c.rfid_uid)
  const fromLegacy = (student.cards ?? []).filter(c => c.is_active !== false).map(c => c.rfid_uid)
  return Array.from(new Set([...(student.rfid_uids ?? []), ...fromCards, ...fromLegacy].filter(Boolean)))
}
function extractCards(student: RosterStudent): Array<{ id: string; rfid_uid: string; label: string | null }> {
  if (student.rfid_cards?.length) return student.rfid_cards.map(c => ({ id: c.id, rfid_uid: c.rfid_uid, label: c.label ?? null }))
  return []
}

export async function syncRoster(): Promise<{ count: number }> {
  const students = normalizeRosterPayload(await apiFetch<unknown>('/api/device/students'))

  // migrate: ensure rfid_cards column exists (safe on existing DBs)
  try { getDb().exec('ALTER TABLE students ADD COLUMN rfid_cards TEXT') } catch { /* already exists */ }

  const existing = new Map((getDb().prepare('SELECT id, photo_url, photo_local_path FROM students').all() as Array<{ id: string; photo_url: string | null; photo_local_path: string | null }>).map((row) => [row.id, row]))

  const stmt = getDb().prepare(`INSERT INTO students (id, student_code, prefix, first_name, last_name, nickname, photo_url, classroom_name, class_number, rfid_uids, rfid_cards, updated_at)
    VALUES (@id, @student_code, @prefix, @first_name, @last_name, @nickname, @photo_url, @classroom_name, @class_number, @rfid_uids, @rfid_cards, @updated_at)
    ON CONFLICT(id) DO UPDATE SET student_code=excluded.student_code, prefix=excluded.prefix, first_name=excluded.first_name, last_name=excluded.last_name,
    nickname=excluded.nickname, photo_url=excluded.photo_url, classroom_name=excluded.classroom_name, class_number=excluded.class_number,
    rfid_uids=excluded.rfid_uids, rfid_cards=excluded.rfid_cards, updated_at=excluded.updated_at`)
  const tx = getDb().transaction((rows: RosterStudent[]) => rows.forEach((s) => stmt.run({
    id: s.id, student_code: s.student_code ?? null, prefix: s.prefix ?? null, first_name: s.first_name, last_name: s.last_name, nickname: s.nickname ?? null,
    photo_url: s.photo_url ?? null, classroom_name: s.classroom_name ?? null, class_number: s.class_number ?? null,
    rfid_uids: JSON.stringify(extractUids(s)), rfid_cards: JSON.stringify(extractCards(s)), updated_at: s.updated_at ?? new Date().toISOString()
  })))
  tx(students)

  // ลบนักเรียนที่หายไปจากเซิร์ฟเวอร์ (ย้าย/ลาออก) — ข้ามถ้า payload ว่างกันข้อมูลหายยกเครื่องจาก glitch ฝั่งเซิร์ฟเวอร์
  if (students.length > 0) {
    const keep = new Set(students.map((s) => s.id))
    const removed = [...existing.keys()].filter((id) => !keep.has(id))
    if (removed.length > 0) {
      const del = getDb().prepare('DELETE FROM students WHERE id = ?')
      getDb().transaction(() => removed.forEach((id) => del.run(id)))()
      removed.forEach((id) => deletePhotoFile(id))
      log('roster', `ลบนักเรียนที่หายจากเซิร์ฟเวอร์ ${removed.length} คน`)
    }
  }

  // โหลดรูปเฉพาะที่ url เปลี่ยนหรือไฟล์หาย — ไม่โหลดทุกคนซ้ำทุกรอบ sync
  const needsPhoto = students.filter((s) => {
    if (!s.photo_url) return false
    const prev = existing.get(s.id)
    return !prev || prev.photo_url !== s.photo_url || !hasPhotoFile(s.id, prev.photo_local_path)
  })
  if (needsPhoto.length > 0) log('roster', `โหลดรูปนักเรียน ${needsPhoto.length}/${students.length} คน`)
  await Promise.all(needsPhoto.map((student) => downloadStudentPhoto(student.id, student.photo_url)))
  return { count: students.length }
}
