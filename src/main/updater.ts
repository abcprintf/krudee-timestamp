import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'

export function initUpdater(win: BrowserWindow): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('updater:update-available', { version: info.version, releaseNotes: info.releaseNotes ?? null })
  })

  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send('updater:download-progress', { percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('updater:update-downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err.message)
  })

  // Check 5 s after startup, then every 4 hours
  setTimeout(() => { autoUpdater.checkForUpdates().catch((e) => console.error('[updater] check failed:', e)) }, 5_000)
  setInterval(() => { autoUpdater.checkForUpdates().catch((e) => console.error('[updater] check failed:', e)) }, 4 * 60 * 60 * 1_000)
}
