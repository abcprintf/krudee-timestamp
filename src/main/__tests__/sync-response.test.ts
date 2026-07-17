import { describe, expect, it } from 'vitest'
import { partitionSyncResponse } from '../sync/response'

const ids = ['a', 'b', 'c']

describe('partitionSyncResponse', () => {
  it('เซิร์ฟเวอร์ตอบ accepted เป็น list → mark เฉพาะที่ยืนยัน', () => {
    expect(partitionSyncResponse(ids, { accepted: ['a', 'b'] })).toEqual({ synced: ['a', 'b'], rejected: ['c'] })
  })
  it('duplicates นับเป็น synced ด้วย (เซิร์ฟเวอร์มีแล้ว)', () => {
    expect(partitionSyncResponse(ids, { accepted: ['a'], duplicates: ['c'] })).toEqual({ synced: ['a', 'c'], rejected: ['b'] })
  })
  it('เซิร์ฟเวอร์รุ่นเก่าตอบเป็นตัวเลข → ถือว่ารับหมด (พฤติกรรมเดิม)', () => {
    expect(partitionSyncResponse(ids, { accepted: 3 })).toEqual({ synced: ids, rejected: [] })
  })
  it('ไม่มี body / body ว่าง → ถือว่ารับหมด', () => {
    expect(partitionSyncResponse(ids, undefined)).toEqual({ synced: ids, rejected: [] })
    expect(partitionSyncResponse(ids, {})).toEqual({ synced: ids, rejected: [] })
  })
  it('accepted list ว่าง → reject ทั้งหมด', () => {
    expect(partitionSyncResponse(ids, { accepted: [] })).toEqual({ synced: [], rejected: ids })
  })
})
