# Electron Auto-Update — Design

**Date:** 2026-05-23
**Project:** krudee-timestamp
**Scope:** Add auto-update via `electron-updater` + GitHub Releases

---

## Overview

Add auto-update capability to the KruDee Timestamp kiosk app. When a new version is published to GitHub Releases, the app notifies the user via a banner in the renderer UI. The user can then trigger the download and install with a button press. Updates are checked automatically on startup and every 4 hours.

---

## Decisions

| Question | Decision |
|----------|----------|
| Update source | GitHub Releases (same repo: krudee-timestamp) |
| Library | `electron-updater` (part of electron-builder ecosystem) |
| Trigger | Manual confirmation — user must press button to install |
| Auto-check | Yes — 5s after startup, then every 4 hours |
| Platforms | Windows (NSIS), Linux (AppImage/deb), macOS (dmg) |

---

## Architecture

```
main: autoUpdater.checkForUpdates()
        ↓ update-available
      ipc push → renderer: show UpdateBanner
        ↓ download-progress (%)
      ipc push → renderer: update progress bar
        ↓ update-downloaded
      ipc push → renderer: show "restart to install"
        ↓ user clicks "ติดตั้งและรีสตาร์ท"
      ipc call ← renderer: 'updater:install'
        ↓
      autoUpdater.quitAndInstall()
```

---

## Files Changed / Added

| File | Change |
|------|--------|
| `package.json` | Add `electron-updater` to dependencies |
| `electron-builder.yml` | Add `publish` block pointing to GitHub |
| `src/main/updater.ts` | **New** — init, schedule checks, IPC push to renderer |
| `src/main/index.ts` | Call `initUpdater(mainWindow)` after window created |
| `src/main/ipc.ts` | Add `updater:install` IPC handler |
| `src/preload/index.ts` | Expose `updater` namespace (onUpdateAvailable, onProgress, onReady, install) |
| `src/renderer/src/components/UpdateBanner.vue` | **New** — banner with version info, progress bar, install button |
| `src/renderer/src/App.vue` | Mount `<UpdateBanner />` |

---

## Main Process: `src/main/updater.ts`

```ts
import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'

export function initUpdater(win: BrowserWindow): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('updater:update-available', info)
  })
  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send('updater:download-progress', progress)
  })
  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('updater:update-downloaded', info)
  })
  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err.message)
  })

  // Check on startup after 5s
  setTimeout(() => autoUpdater.checkForUpdates(), 5_000)
  // Check every 4 hours
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1_000)
}
```

---

## IPC: `updater:install`

In `src/main/ipc.ts`, add:
```ts
ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall()
})
```

---

## Preload: `src/preload/index.ts`

Expose via `contextBridge`:
```ts
updater: {
  onUpdateAvailable: (cb) => ipcRenderer.on('updater:update-available', (_, info) => cb(info)),
  onDownloadProgress: (cb) => ipcRenderer.on('updater:download-progress', (_, p) => cb(p)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('updater:update-downloaded', (_, info) => cb(info)),
  install: () => ipcRenderer.invoke('updater:install'),
}
```

---

## Renderer: `UpdateBanner.vue`

- Listens to `window.electron.updater.on*` events
- Shows banner when update is available: version number + download progress bar
- When downloaded: shows "ติดตั้งและรีสตาร์ท" button
- Silent (hidden) when no update

---

## electron-builder.yml — publish block

```yaml
publish:
  provider: github
  owner: <github-username>
  repo: krudee-timestamp
```

Set env `GH_TOKEN` when running `build:win`, `build:linux`, `build:mac` to publish releases.

---

## Notes

- On **macOS**, `autoUpdater` requires the app to be code-signed and notarized for updates to install. For dev/testing, can use `forceDevUpdateConfig: true`.
- On **Linux AppImage**, `electron-updater` supports AppImage updates natively.
- **deb** packages on Linux do not support in-app auto-update — user must reinstall from GitHub Releases manually. The banner should indicate this and open the releases URL instead of calling `quitAndInstall()`.
