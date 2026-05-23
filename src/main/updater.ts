import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'

let initialized = false

export function initUpdater(win: BrowserWindow): void {
  if (initialized) return
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    if (win.isDestroyed()) return
    win.webContents.send('updater:update-available', { version: info.version, releaseNotes: info.releaseNotes ?? null })
  })

  autoUpdater.on('download-progress', (progress) => {
    if (win.isDestroyed()) return
    win.webContents.send('updater:download-progress', { percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    if (win.isDestroyed()) return
    win.webContents.send('updater:update-downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err.stack ?? err.message)
  })

  setTimeout(() => {
    if (win.isDestroyed()) return
    autoUpdater.checkForUpdates().catch((e) => console.error('[updater] check failed:', e))
  }, 5_000)

  const intervalId = setInterval(() => {
    if (win.isDestroyed()) return
    autoUpdater.checkForUpdates().catch((e) => console.error('[updater] check failed:', e))
  }, 4 * 60 * 60 * 1_000)

  win.on('closed', () => {
    clearInterval(intervalId)
    autoUpdater.removeAllListeners()
  })
}
