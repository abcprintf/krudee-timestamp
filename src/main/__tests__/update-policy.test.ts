import { describe, it, expect } from 'vitest'
import { compareVersions, shouldDownload } from '../update-policy'

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
