// Pure parser ของ response จาก /api/device/attendance/sync — แยกไว้เพื่อ unit test
export interface SyncResponse { accepted?: string[] | number; duplicates?: string[] | number; unknown_uids?: string[] }

function asIdList(value: string[] | number | undefined): string[] | null {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null
}

// เซิร์ฟเวอร์รุ่นใหม่ตอบ accepted/duplicates เป็น list ของ client_event_id → mark synced เฉพาะที่เซิร์ฟเวอร์ยืนยัน
// รุ่นเก่าตอบเป็นตัวเลขหรือไม่ตอบเลย → ถือว่า 2xx = รับหมด (พฤติกรรมเดิม)
export function partitionSyncResponse(eventIds: string[], response: unknown): { synced: string[]; rejected: string[] } {
  const body = (response ?? {}) as SyncResponse
  const accepted = asIdList(body.accepted)
  const duplicates = asIdList(body.duplicates)
  if (accepted === null && duplicates === null) return { synced: eventIds, rejected: [] }
  const acknowledged = new Set([...(accepted ?? []), ...(duplicates ?? [])])
  return { synced: eventIds.filter((id) => acknowledged.has(id)), rejected: eventIds.filter((id) => !acknowledged.has(id)) }
}
