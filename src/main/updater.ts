import { autoUpdater } from 'electron-updater'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { logError, log } from './logger'
import { getConfig } from './config'
import { getDb } from './db/client'
import { shouldDownload, shouldInstallNow } from './update-policy'

let initialized = false
let pendingVersion: string | null = null

const IDLE_MS = 2 * 60 * 1000

function lastScanAt(): string | null {
  try { return (getDb().prepare('SELECT MAX(scanned_at) AS t FROM scan_events').get() as { t: string | null }).t } catch { return null }
}

export function initUpdater(win: BrowserWindow): void {
  if (!app.isPackaged) return
  if (initialized) return
  initialized = true

  autoUpdater.autoDownload = false            // โหลดเฉพาะเวอร์ชันที่ server อนุญาต
  autoUpdater.autoInstallOnAppQuit = false     // ติดตั้งเองเฉพาะในหน้าต่างเวลา

  autoUpdater.on('update-available', (info) => {
    const target = getConfig().target_version
    if (!shouldDownload(info.version, target)) { log('updater', `พบ ${info.version} แต่ target=${target ?? '-'} — ยังไม่โหลด`); return }
    if (win.isDestroyed()) return
    win.webContents.send('updater:update-available', { version: info.version, releaseNotes: info.releaseNotes ?? null })
    autoUpdater.downloadUpdate().catch((e) => logError('updater', 'download failed', e))
  })

  autoUpdater.on('download-progress', (progress) => {
    if (win.isDestroyed()) return
    win.webContents.send('updater:download-progress', { percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    pendingVersion = info.version
    if (win.isDestroyed()) return
    win.webContents.send('updater:update-downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => { logError('updater', err) })

  const timeoutId = setTimeout(() => { if (!win.isDestroyed()) autoUpdater.checkForUpdates().catch((e) => logError('updater', 'check failed', e)) }, 5_000)
  const checkId = setInterval(() => { if (!win.isDestroyed()) autoUpdater.checkForUpdates().catch((e) => logError('updater', 'check failed', e)) }, 4 * 60 * 60 * 1_000)
  const installId = setInterval(() => maybeInstall(), 60 * 1_000)

  win.on('closed', () => { clearTimeout(timeoutId); clearInterval(checkId); clearInterval(installId); autoUpdater.removeAllListeners() })
}

function maybeInstall(): void {
  if (!pendingVersion) return
  const c = getConfig()
  const ok = shouldInstallNow({
    now: new Date(), windowStart: c.update_window_start, windowEnd: c.update_window_end,
    autoInstall: c.update_auto_install === 'true', pendingVersion, targetVersion: c.target_version,
    lastScanAt: lastScanAt(), idleMs: IDLE_MS,
  })
  if (!ok) return
  log('updater', `ติดตั้ง ${pendingVersion} ในหน้าต่างเวลา ${c.update_window_start}-${c.update_window_end}`)
  try { autoUpdater.quitAndInstall() } catch (e) { logError('updater', 'quitAndInstall failed', e) }
}

// ปุ่ม "ติดตั้งตอนนี้" ของแอดมิน — force ทันที
export function triggerInstall(): void { try { autoUpdater.quitAndInstall() } catch (e) { logError('updater', 'quitAndInstall failed', e) } }
