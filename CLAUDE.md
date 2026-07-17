# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

KruDee Timestamp is an Electron + Vue 3 RFID attendance kiosk for Thai schools. Students tap keyboard-wedge RFID cards (or type a student code as fallback); the kiosk matches against a locally cached roster, records the scan in SQLite, speaks a Thai greeting via system TTS, and syncs to the KruDee server on a cron.

## Common commands

```bash
npm install            # installs and runs electron-builder install-app-deps (postinstall)
npm run dev            # electron-vite dev (auto-patches Electron app name on first run)
npm run typecheck      # vue-tsc --noEmit
npm test               # vitest run (pure logic in src/main/scan-logic.ts, src/main/sync/response.ts)
npm run build          # electron-vite build (output to out/)
npm run build:mac      # build + electron-builder --mac (also :win, :linux)
```

Default dev server base URL is `http://localhost:3000`; production default is `https://krudee.workitdee.com` (see `src/main/config.ts`).

## Architecture

Three-process Electron layout under `src/`:

- `src/main/` — Node-side. Owns the SQLite database, all I/O, and IPC handlers. The renderer is sandboxed and must go through `ipcMain.handle` channels in `src/main/ipc.ts`.
- `src/preload/index.ts` — exposes a typed bridge to the renderer via `contextBridge`. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`.
- `src/renderer/` — Vue 3 + vue-router SPA. Pages: `Setup.vue` (first-run device pairing), `Kiosk.vue` (main scan UI), `Admin.vue`, `Offline.vue`. The window is launched full-screen on the primary display.

### Data flow for a scan (the central path)

1. `Kiosk.vue` buffers keyboard events (keyboard-wedge RFID readers act as a HID keyboard). The student-code fallback uses the same channel.
2. Renderer invokes the `scan:record` IPC → `src/main/ipc.ts`.
3. Handler looks up by `rfid_uids` first (exact match via `json_each`), then by `student_code`, applies a **per-student cooldown** (configurable `scan_cooldown_minutes`, default 30 — returns `duplicate: true` without inserting), determines `entry` vs `exit` based on the configured `role` (`entry` / `exit` / `both`), today's prior events, and `exit_after_hour` (both-mode: first scan after this hour counts as exit), inserts into `scan_events`, fires TTS greeting, schedules a debounced sync, and returns `queue_count` of unsynced rows.
4. `src/main/sync/scheduler.ts` runs `node-cron`: attendance + heartbeat every 5 min, roster pull every 30 min, prune of old synced events daily — plus a debounced sync a few seconds after each scan.

When changing scan logic, the rules in `src/main/scan-logic.ts` (pure, unit-tested) + their wiring in `ipc.ts` are load-bearing — entry/exit is decided server-side-of-Electron, not by the renderer.

### Subsystems

- **DB** (`src/main/db/`): `better-sqlite3` opened at `app.getPath('userData')/krudee-timestamp.sqlite`. Schema is executed from `schema.sql` on every `getDb()` (idempotent `CREATE TABLE IF NOT EXISTS`). The file is resolved from `process.cwd()`, `resourcesPath`, or `__dirname/db/` — keep all three working when packaging. WAL mode + foreign keys on.
- **Config** (`src/main/config.ts`): a `config` key/value table in the same SQLite DB, accessed via `getConfig()` / `setConfigValues()`. There is no JSON config file — all settings (base_url, device_token, role, admin_pin_hash, tts_enabled, auto_start, exit_after_hour, late_after, scan_cooldown_minutes, greeting templates, kiosk_lock) live in SQLite. The renderer only ever sees the whitelisted subset from `getSafeConfig()` — never tokens or the PIN hash.
- **API client** (`src/main/api/client.ts`): `ofetch` wrapper; attaches the device token from config. Setup flow calls `registerDevice`, then the device_id/device_token are persisted and used for every subsequent call.
- **Sync** (`src/main/sync/`): `attendance.ts` pushes unsynced `scan_events`, `roster.ts` pulls students, `scheduler.ts` owns the cron tasks. `syncNow()` has a `running` guard — don't add parallel callers.
- **RFID** (`src/main/rfid/`, `src/main/rfid-device.ts`): Keyboard-wedge is the primary path and lives in the renderer. `src/main/rfid/reader.ts` is the stub for future serial/HID readers. `rfid-device.ts` uses the `usb` package to detect when a reader is plugged in.
- **TTS** (`src/main/tts/`): system TTS per-platform — `espeak` (Linux), `say` (macOS), PowerShell `SpeechSynthesizer` (Windows). `cache.ts` is a stub for future pre-rendered assets.
- **Photos** (`src/main/photos.ts`): registers a custom `student-photo://` protocol so the renderer can display locally cached student photos without exposing the filesystem.
- **Updater** (`src/main/updater.ts`): `electron-updater` wired to a banner in the renderer (`UpdateBanner.vue`). Version string is injected at build time as `VITE_APP_VERSION` from `package.json` (see `electron.vite.config.ts`).
- **Auto-launch** (`src/main/auto-launch.ts`): toggled from Admin UI; persisted as `auto_start` in config.

### Build / packaging notes

- Entry points are defined by `electron-vite` (see `electron.vite.config.ts`): main → `out/main`, preload → `out/preload`, renderer → `out/renderer`. `package.json` `main` points at `out/main/index.js`.
- `electron-builder.yml` controls packaging; `appId` is `app.krudee.timestamp`. `scripts/patch-electron.js` renames the dev Electron binary so the macOS app shows the right name during `npm run dev`.
- `resources/` holds platform icons resolved at runtime via `getIconPath()` in `src/main/index.ts`.

## Conventions worth knowing

- Code style in `src/main/` is intentionally dense (single-line functions, inline types). Match the surrounding style when editing — don't reformat existing files just to add line breaks.
- All renderer→main communication goes through `ipcMain.handle` channels defined in `src/main/ipc.ts`. Add new channels there and expose them in `src/preload/index.ts`.
- User-facing strings are Thai (e.g. greetings in `ipc.ts` `greeting()`). Don't translate without asking.
- Times are stored as ISO strings in SQLite; "today" is computed in local time via `setHours(0,0,0,0)`.
