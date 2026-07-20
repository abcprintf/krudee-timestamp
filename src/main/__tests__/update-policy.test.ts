import { describe, it, expect } from 'vitest'
import { compareVersions, shouldDownload, shouldInstallNow } from '../update-policy'

describe('compareVersions', () => {
  it('orders by major.minor.patch', () => {
    expect(compareVersions('1.0.10', '1.0.9')).toBe(1)
    expect(compareVersions('1.0.9', '1.0.10')).toBe(-1)
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0)
  })
  it('strips v prefix and pre-release', () => {
    expect(compareVersions('v1.0.10', '1.0.10')).toBe(0)
    expect(compareVersions('1.0.10-beta.1', '1.0.10')).toBe(0)
  })
  it('treats unparseable parts as 0', () => {
    expect(compareVersions('', '0.0.0')).toBe(0)
  })
})

describe('shouldDownload', () => {
  it('downloads when new <= target', () => {
    expect(shouldDownload('1.0.10', '1.0.10')).toBe(true)
    expect(shouldDownload('1.0.9', '1.0.10')).toBe(true)
  })
  it('blocks when new > target', () => {
    expect(shouldDownload('1.0.11', '1.0.10')).toBe(false)
  })
  it('blocks when target missing (fail-safe)', () => {
    expect(shouldDownload('1.0.10', undefined)).toBe(false)
    expect(shouldDownload('1.0.10', '')).toBe(false)
  })
})

describe('shouldInstallNow', () => {
  const base = {
    windowStart: '12:00', windowEnd: '13:00', autoInstall: true,
    pendingVersion: '1.0.10', targetVersion: '1.0.10',
    lastScanAt: null, idleMs: 2 * 60 * 1000,
  }
  const at = (h: number, m: number) => { const d = new Date(2026, 6, 20, h, m, 0); return d }

  it('installs inside window when idle', () => {
    expect(shouldInstallNow({ ...base, now: at(12, 30) })).toBe(true)
  })
  it('skips outside window', () => {
    expect(shouldInstallNow({ ...base, now: at(9, 0) })).toBe(false)
    expect(shouldInstallNow({ ...base, now: at(13, 1) })).toBe(false)
  })
  it('skips when a scan happened within idleMs', () => {
    const now = at(12, 30)
    const recent = new Date(now.getTime() - 30 * 1000).toISOString()
    expect(shouldInstallNow({ ...base, now, lastScanAt: recent })).toBe(false)
  })
  it('installs when last scan older than idleMs', () => {
    const now = at(12, 30)
    const old = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
    expect(shouldInstallNow({ ...base, now, lastScanAt: old })).toBe(true)
  })
  it('skips when autoInstall off or no pending', () => {
    expect(shouldInstallNow({ ...base, now: at(12, 30), autoInstall: false })).toBe(false)
    expect(shouldInstallNow({ ...base, now: at(12, 30), pendingVersion: null })).toBe(false)
  })
  it('skips when pending exceeds target (target rolled back)', () => {
    expect(shouldInstallNow({ ...base, now: at(12, 30), pendingVersion: '1.0.11', targetVersion: '1.0.10' })).toBe(false)
  })
})
