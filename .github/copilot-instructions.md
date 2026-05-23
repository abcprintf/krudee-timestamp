# KruDee Timestamp — Copilot Instructions

## Commands

```bash
npm run dev          # Start dev server (electron-vite + hot reload)
npm run build        # Build all three processes (main, preload, renderer)
npm run typecheck    # Type-check renderer (vue-tsc --noEmit)

npm run build:linux  # Package for Linux (AppImage)
npm run build:win    # Package for Windows
npm run build:mac    # Package for macOS
```

There is no test suite.

## Architecture

Electron app with three processes:

| Process | Path | Role |
|---------|------|------|
| Main | `src/main/` | IPC handlers, SQLite DB, sync scheduler, TTS, RFID device monitor |
| Preload | `src/preload/index.ts` | Context bridge — exposes `window.krudee` to renderer |
| Renderer | `src/renderer/` | Vue 3 SPA (Vue Router, hash history) |

### IPC Contract

All renderer↔main communication goes through `window.krudee` (defined in preload). Every channel must be:
1. Declared in `src/preload/index.ts` via `contextBridge.exposeInMainWorld('krudee', ...)`
2. Handled in `src/main/ipc.ts` via `ipcMain.handle(...)`

### Renderer Pages

`/setup` → `Setup.vue` — first-run device registration  
`/kiosk` → `Kiosk.vue` — main RFID scan display  
`/admin` → `Admin.vue` — PIN-gated admin panel  
`/offline` → `Offline.vue` — shown when server unreachable  

Router guard (`src/renderer/router.ts`) redirects to `/setup` if `device_id`/`device_token` are missing from config.

### SQLite Database

Stored at `app.getPath('userData')/krudee-timestamp.sqlite`. Schema is applied idempotently on startup from `src/main/db/schema.sql`.

Key tables:
- `config` — key/value store for all app settings (base_url, device_id, device_token, role, admin_pin, etc.)
- `students` — local roster cache; `rfid_uids` and `rfid_cards` are **JSON strings** (not arrays)
- `scan_events` — attendance records with `synced INTEGER` flag

### Config

`getConfig()` in `src/main/config.ts` merges DB values over typed defaults. All config values are strings. Dev default server: `http://localhost:3000`; prod: `https://krudee.workitdee.com`.

`isConfigured()` returns true only when both `device_id` and `device_token` are present.

## Key Conventions

### RFID UID Lookup

`rfid_uids` in the `students` table is a JSON array stored as TEXT. Lookups use `LIKE '%uid%'` then filter with `JSON.parse` — see `findStudentByUid` in `ipc.ts`. Do not query by exact column match.

### Scan Kind Logic

`KioskRole` is `'entry' | 'exit' | 'both'`. When role is `'both'`, the first scan of the day is always `entry`; subsequent scans are `exit`. A 30-minute cooldown (`SCAN_COOLDOWN_MS`) deduplicates rapid re-taps and returns the previous kind without inserting a new row.

### TTS

`speak()` in `src/main/tts/index.ts` calls platform-specific commands: `espeak` (Linux), `say` (macOS), PowerShell `SpeechSynthesizer` (Windows). Greetings are Thai strings. TTS is skipped when `config.tts_enabled === 'false'`.

### Sync Scheduler

- Attendance sync: every **5 minutes** via `node-cron`
- Roster sync: every **30 minutes**
- `syncNow()` is mutex-guarded (`running` flag) to prevent overlapping runs

### Custom Protocol

`student-photo://` serves local student photo files. Registered in main via `registerStudentPhotoProtocol()` before the window is created.

### Bundling

`ofetch` is **bundled** (not externalized). `better-sqlite3`, `node-cron`, `auto-launch`, and `usb` are externalized (native modules handled by electron-builder).

### Auto-update

`electron-updater` is used. On Linux, if the app is not running as an AppImage, `updater:install` opens the GitHub releases page instead of triggering an in-app update.
