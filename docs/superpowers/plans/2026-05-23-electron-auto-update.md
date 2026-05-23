# Electron Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-update via `electron-updater` + GitHub Releases so the kiosk app checks for and installs new versions with a user-visible banner.

**Architecture:** `electron-updater` runs in the main process, emits events to the renderer via IPC push (same pattern as existing `rfid-device-changed`). The renderer shows a `UpdateBanner.vue` component when an update is available. The user presses a button to download+install. On Linux deb the banner opens GitHub Releases URL instead.

**Tech Stack:** electron-updater, electron-builder (already installed), Vue 3, IPC contextBridge

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | Modify | Add `electron-updater` dependency |
| `electron-builder.yml` | Modify | Add `publish` block (GitHub, owner: abcprintf, repo: krudee-timestamp) |
| `src/main/updater.ts` | **Create** | Init autoUpdater, schedule checks, push IPC events to renderer |
| `src/main/index.ts` | Modify | Call `initUpdater(mainWindow)` after `createWindow()` |
| `src/main/ipc.ts` | Modify | Add `updater:install` IPC handler |
| `src/preload/index.ts` | Modify | Expose `krudee.updater` namespace |
| `src/renderer/env.d.ts` | Modify | Add `updater` types to `Krudee` interface |
| `src/renderer/components/UpdateBanner.vue` | **Create** | Banner UI — shows version, download progress, install button |
| `src/renderer/App.vue` | Modify | Mount `<UpdateBanner />` above `<RouterView />` |

---

## Task 1: Install electron-updater and configure publish

**Files:**
- Modify: `package.json`
- Modify: `electron-builder.yml`

- [ ] **Step 1: Install electron-updater**

```bash
cd /Users/abcprintf/DATA/_serverAbcprintf/krudee-timestamp
npm install electron-updater
```

Expected: `electron-updater` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Add publish block to electron-builder.yml**

Open `electron-builder.yml` and add at the end:

```yaml
publish:
  provider: github
  owner: abcprintf
  repo: krudee-timestamp
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json electron-builder.yml
git commit -m "chore: install electron-updater, add github publish config"
```

---

## Task 2: Create `src/main/updater.ts`

**Files:**
- Create: `src/main/updater.ts`

- [ ] **Step 1: Create the file**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/main/updater.ts
git commit -m "feat: add updater.ts — init electron-updater, schedule checks"
```

---

## Task 3: Wire updater into main process

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc.ts`

- [ ] **Step 1: Import and call initUpdater in index.ts**

In `src/main/index.ts`, add the import at the top (after existing imports):

```ts
import { initUpdater } from './updater'
```

Inside `app.whenReady().then(async () => { ... })`, add `initUpdater(mainWindow)` **after** the `createWindow()` call:

```ts
app.whenReady().then(async () => {
  getDb(); registerStudentPhotoProtocol(); registerIpcHandlers(); startScheduler()
  if (getConfig().auto_start === 'true') await setAutoLaunch(true)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  createWindow()
  if (mainWindow) initUpdater(mainWindow)
})
```

- [ ] **Step 2: Add updater:install IPC handler in ipc.ts**

In `src/main/ipc.ts`, add the import at the top (after existing imports):

```ts
import { autoUpdater } from 'electron-updater'
```

Inside `registerIpcHandlers()`, add before the closing `}`:

```ts
  ipcMain.handle('updater:install', () => { autoUpdater.quitAndInstall() })
```

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts src/main/ipc.ts
git commit -m "feat: wire initUpdater into main process, add updater:install IPC"
```

---

## Task 4: Expose updater API via preload

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add updater namespace to the api object**

Open `src/preload/index.ts`. The file currently ends with `contextBridge.exposeInMainWorld('krudee', api)`. Add `updater` to the `api` object:

```ts
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  config: { get: () => ipcRenderer.invoke('config:get') },
  setup: { register: (payload: unknown) => ipcRenderer.invoke('setup:register', payload) },
  scan: { record: (payload: { uid: string; scanned_at?: string }) => ipcRenderer.invoke('scan:record', payload), queueCount: () => ipcRenderer.invoke('scan:queue-count') },
  sync: { now: () => ipcRenderer.invoke('sync:now'), roster: () => ipcRenderer.invoke('roster:sync') },
  device: {
    rfidStatus: () => ipcRenderer.invoke('device:rfid-status'),
    onRfidStatusChange: (cb: (status: { connected: boolean; count: number }) => void) => {
      const listener = (_: unknown, status: { connected: boolean; count: number }) => cb(status)
      ipcRenderer.on('rfid-device-changed', listener)
      return () => ipcRenderer.off('rfid-device-changed', listener)
    },
  },
  admin: {
    verifyPin: (pin: string) => ipcRenderer.invoke('admin:verify-pin', pin), students: (query?: string) => ipcRenderer.invoke('admin:students', query), unknownUids: () => ipcRenderer.invoke('admin:unknown-uids'),
    bindCard: (payload: { student_id: string; rfid_uid: string; label?: string }) => ipcRenderer.invoke('admin:bind-card', payload), unbindCard: (payload: { card_id: string }) => ipcRenderer.invoke('admin:unbind-card', payload),
    clearUnknownUids: () => ipcRenderer.invoke('admin:clear-unknown-uids'),
    deleteUnknownUid: (uid: string) => ipcRenderer.invoke('admin:delete-unknown-uid', uid),
    updateSettings: (payload: Record<string, string>) => ipcRenderer.invoke('admin:settings:update', payload), history: () => ipcRenderer.invoke('admin:history'), resetDevice: () => ipcRenderer.invoke('admin:reset-device')
  },
  updater: {
    onUpdateAvailable: (cb: (info: { version: string; releaseNotes: string | null }) => void) => {
      const listener = (_: unknown, info: { version: string; releaseNotes: string | null }) => cb(info)
      ipcRenderer.on('updater:update-available', listener)
      return () => ipcRenderer.off('updater:update-available', listener)
    },
    onDownloadProgress: (cb: (progress: { percent: number }) => void) => {
      const listener = (_: unknown, progress: { percent: number }) => cb(progress)
      ipcRenderer.on('updater:download-progress', listener)
      return () => ipcRenderer.off('updater:download-progress', listener)
    },
    onUpdateDownloaded: (cb: (info: { version: string }) => void) => {
      const listener = (_: unknown, info: { version: string }) => cb(info)
      ipcRenderer.on('updater:update-downloaded', listener)
      return () => ipcRenderer.off('updater:update-downloaded', listener)
    },
    install: () => ipcRenderer.invoke('updater:install'),
  },
}
contextBridge.exposeInMainWorld('krudee', api)
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: expose krudee.updater namespace in preload"
```

---

## Task 5: Add TypeScript types for updater in renderer

**Files:**
- Modify: `src/renderer/env.d.ts`

- [ ] **Step 1: View current env.d.ts**

```bash
cat src/renderer/env.d.ts
```

- [ ] **Step 2: Add updater types**

Find the `Krudee` or `Window` interface declaration in `src/renderer/env.d.ts` and add the `updater` property. If the file currently looks like:

```ts
interface Window {
  krudee: {
    // ... existing types
  }
}
```

Add `updater` to the interface:

```ts
updater: {
  onUpdateAvailable: (cb: (info: { version: string; releaseNotes: string | null }) => void) => () => void
  onDownloadProgress: (cb: (progress: { percent: number }) => void) => () => void
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => () => void
  install: () => Promise<void>
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/env.d.ts
git commit -m "feat: add updater types to renderer env.d.ts"
```

---

## Task 6: Create UpdateBanner.vue component

**Files:**
- Create: `src/renderer/components/UpdateBanner.vue`

- [ ] **Step 1: Create the component**

```vue
<template>
  <Transition name="slide-down">
    <div v-if="state !== 'idle'" class="update-banner">
      <template v-if="state === 'available'">
        <span class="update-text">🔄 มีเวอร์ชันใหม่ v{{ newVersion }} กำลังดาวน์โหลด...</span>
        <div class="progress-bar"><div class="progress-fill" :style="{ width: `${downloadPercent}%` }" /></div>
        <span class="progress-label">{{ downloadPercent }}%</span>
      </template>
      <template v-else-if="state === 'ready'">
        <span class="update-text">✅ v{{ newVersion }} พร้อมติดตั้งแล้ว</span>
        <button class="install-btn" :disabled="installing" @click="install">
          {{ installing ? 'กำลังรีสตาร์ท...' : 'ติดตั้งและรีสตาร์ท' }}
        </button>
      </template>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

type BannerState = 'idle' | 'available' | 'ready'

const state = ref<BannerState>('idle')
const newVersion = ref('')
const downloadPercent = ref(0)
const installing = ref(false)

let offAvailable: (() => void) | null = null
let offProgress: (() => void) | null = null
let offDownloaded: (() => void) | null = null

onMounted(() => {
  offAvailable = window.krudee.updater.onUpdateAvailable((info) => {
    newVersion.value = info.version
    downloadPercent.value = 0
    state.value = 'available'
  })
  offProgress = window.krudee.updater.onDownloadProgress((progress) => {
    downloadPercent.value = progress.percent
  })
  offDownloaded = window.krudee.updater.onUpdateDownloaded((info) => {
    newVersion.value = info.version
    state.value = 'ready'
  })
})

onUnmounted(() => {
  offAvailable?.()
  offProgress?.()
  offDownloaded?.()
})

async function install(): Promise<void> {
  installing.value = true
  await window.krudee.updater.install()
}
</script>

<style scoped>
.update-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #1e40af;
  color: #fff;
  font-size: 13px;
}
.update-text { flex: 1; font-weight: 500; }
.progress-bar { width: 120px; height: 6px; background: rgba(255,255,255,0.3); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: #fff; border-radius: 3px; transition: width 0.3s ease; }
.progress-label { min-width: 36px; text-align: right; font-size: 12px; opacity: 0.85; }
.install-btn {
  padding: 4px 14px;
  background: #fff;
  color: #1e40af;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.install-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.install-btn:not(:disabled):hover { background: #eff6ff; }
.slide-down-enter-active, .slide-down-leave-active { transition: transform 0.25s ease, opacity 0.25s ease; }
.slide-down-enter-from, .slide-down-leave-to { transform: translateY(-100%); opacity: 0; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/UpdateBanner.vue
git commit -m "feat: add UpdateBanner.vue component"
```

---

## Task 7: Mount UpdateBanner in App.vue

**Files:**
- Modify: `src/renderer/App.vue`

- [ ] **Step 1: Add UpdateBanner to App.vue**

Replace `src/renderer/App.vue` with:

```vue
<template>
  <UpdateBanner />
  <RouterView />
  <footer class="app-footer">
    <span>ระบบจัดการโรงเรียน</span>
    <a href="https://krudee.workitdee.com/" target="_blank" rel="noopener">krudee.workitdee.com</a>
    <span class="version">v{{ version }}</span>
  </footer>
</template>

<script setup lang="ts">
import UpdateBanner from './components/UpdateBanner.vue'
const version = import.meta.env.VITE_APP_VERSION ?? '0.1.0'
</script>

<style scoped>
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
  background: rgba(248, 250, 252, 0.85);
  backdrop-filter: blur(4px);
  border-top: 1px solid #e2e8f0;
  z-index: 9999;
  pointer-events: none;
}
.app-footer a {
  color: #2563eb;
  text-decoration: none;
  font-weight: 600;
  pointer-events: auto;
}
.app-footer a:hover {
  text-decoration: underline;
}
.version {
  color: #cbd5e1;
  font-size: 10px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/App.vue
git commit -m "feat: mount UpdateBanner in App.vue"
```

---

## Task 8: Build and verify

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/abcprintf/DATA/_serverAbcprintf/krudee-timestamp
npm run typecheck
```

Expected: No errors.

- [ ] **Step 2: Build the app**

```bash
npm run build
```

Expected: Build succeeds in `out/`.

- [ ] **Step 3: (Optional) Test update flow in dev mode**

In dev mode, `autoUpdater` calls will fail silently (no published release to check). To verify the banner UI without a real update, temporarily add in `src/main/updater.ts` inside `initUpdater`, after the listeners are registered:

```ts
// DEV ONLY — remove before merge
if (process.env.ELECTRON_RENDERER_URL) {
  setTimeout(() => {
    win.webContents.send('updater:update-available', { version: '99.0.0', releaseNotes: null })
    setTimeout(() => win.webContents.send('updater:download-progress', { percent: 60 }), 1000)
    setTimeout(() => win.webContents.send('updater:update-downloaded', { version: '99.0.0' }), 2500)
  }, 3000)
}
```

Run `npm run dev`, confirm the banner slides in, progress updates, and "ติดตั้งและรีสตาร์ท" button appears. **Remove the dev block before committing.**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: electron auto-update via electron-updater + GitHub Releases"
```

---

## Publishing a Release

To trigger auto-update on installed clients, publish a GitHub Release:

```bash
# Bump version in package.json first, e.g. 0.1.0 → 0.2.0
npm version patch   # or minor / major

# Build and publish to GitHub Releases (requires GH_TOKEN env var)
GH_TOKEN=<your_token> npm run build:win    # Windows NSIS
GH_TOKEN=<your_token> npm run build:linux  # Linux AppImage + deb
GH_TOKEN=<your_token> npm run build:mac    # macOS dmg
```

The build uploads installers + `latest.yml` / `latest-linux.yml` to the GitHub Release. Running apps will detect the new version within 5 seconds of next startup or within 4 hours.

> **Linux deb note:** `.deb` packages do not support in-app silent update. The banner will still appear but `updater:install` will not work. For deb users, guide them to download the new `.deb` from GitHub Releases manually.
