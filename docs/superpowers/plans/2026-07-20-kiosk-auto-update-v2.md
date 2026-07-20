# Kiosk Auto Update v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ kiosk อัปเดต+ติดตั้งเองแบบไร้คนดูแลในหน้าต่างเวลาที่แอดมินตั้งได้ โดย server คุมเวอร์ชันที่อนุญาต (per-school) และ Linux auto-update ทำงานจริง

**Architecture:** คงการใช้ `electron-updater` + GitHub Releases เดิม เพิ่ม pure policy module (`update-policy.ts`) ตัดสินใจ "โหลดไหม / ติดตั้งตอนนี้ไหม" จากค่า config + target_version; wire เข้า `updater.ts`; parse `target_version` จาก heartbeat response; ปรับ builder เหลือ AppImage; เพิ่ม UI ใน Admin

**Tech Stack:** Electron, electron-updater, better-sqlite3 (config table), node-cron, Vue 3, vitest

## Global Constraints

- โค้ดใน `src/main/` เขียนแบบ dense (single-line functions, inline types) — match สไตล์รอบข้าง ห้าม reformat ไฟล์เดิม
- renderer↔main ผ่าน `ipcMain.handle` ใน `src/main/ipc.ts` + expose ใน `src/preload/index.ts` เท่านั้น
- config ทั้งหมดอยู่ใน SQLite `config` table ผ่าน `getConfig()`/`setConfigValues()` — ไม่มีไฟล์ JSON config
- renderer เห็นเฉพาะ key ใน `SAFE_KEYS` (`getSafeConfig()`) — ห้ามหลุด token/pin
- string ผู้ใช้เป็นภาษาไทย — ห้ามแปลโดยไม่ถาม
- เวลา "วันนี้" คิดแบบ local time
- pure logic ที่ unit-test ได้ ต้องแยกออกเป็นฟังก์ชันบริสุทธิ์ (แบบ `scan-logic.ts` / `response.ts`)
- อัปเดต CHANGELOG.md **และ** Admin.vue changelog array พร้อมกันเสมอ
- Windows signing, auto-rollback boot-crash, update channel = OUT OF SCOPE
- Server (`target_version` per-school API) = โปรเจกต์ krudee แยก PR — Task 8 เป็น spec-stub เท่านั้น

---

### Task 1: Pure version compare + should-download

**Files:**
- Create: `src/main/update-policy.ts`
- Test: `src/main/__tests__/update-policy.test.ts`

**Interfaces:**
- Produces:
  - `compareVersions(a: string, b: string): number` — คืน -1/0/1 เทียบ semver แบบ `major.minor.patch` (ตัด prefix `v`, ตัด pre-release/build ทิ้ง, ส่วนที่ parse ไม่ได้ = 0)
  - `shouldDownload(newVersion: string, targetVersion: string | undefined): boolean` — true เมื่อ `targetVersion` มีค่าและ `compareVersions(newVersion, targetVersion) <= 0`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- update-policy`
Expected: FAIL — "Cannot find module '../update-policy'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/main/update-policy.ts — pure logic ตัดสิน auto-update, แยกไว้เพื่อ unit test (แบบ scan-logic.ts)

function parse(v: string): [number, number, number] {
  const core = String(v).trim().replace(/^v/, '').split(/[-+]/)[0]
  const [a, b, c] = core.split('.').map((n) => Number.parseInt(n, 10))
  return [a || 0, b || 0, c || 0]
}

export function compareVersions(a: string, b: string): number {
  const pa = parse(a), pb = parse(b)
  for (let i = 0; i < 3; i++) { if (pa[i] > pb[i]) return 1; if (pa[i] < pb[i]) return -1 }
  return 0
}

export function shouldDownload(newVersion: string, targetVersion: string | undefined): boolean {
  if (!targetVersion) return false
  return compareVersions(newVersion, targetVersion) <= 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- update-policy`
Expected: PASS (all cases)

- [ ] **Step 5: Commit**

```bash
git add src/main/update-policy.ts src/main/__tests__/update-policy.test.ts
git commit -m "feat(updater): add pure version compare + should-download policy"
```

---

### Task 2: Pure should-install-now (window + idle guard)

**Files:**
- Modify: `src/main/update-policy.ts`
- Test: `src/main/__tests__/update-policy.test.ts`

**Interfaces:**
- Consumes: `compareVersions` (Task 1)
- Produces:
  - `shouldInstallNow(p: InstallDecision): boolean`
  - `interface InstallDecision { now: Date; windowStart: string; windowEnd: string; autoInstall: boolean; pendingVersion: string | null; targetVersion: string | undefined; lastScanAt: string | null; idleMs: number }`
  - เงื่อนไข true ทั้งหมด: `autoInstall` เปิด, มี `pendingVersion`, `pendingVersion <= targetVersion`, เวลา `now` (HH:mm local) อยู่ในช่วง `[windowStart, windowEnd]`, และ (ไม่มี `lastScanAt` หรือ `now - lastScanAt >= idleMs`)

- [ ] **Step 1: Write the failing test**

```typescript
import { shouldInstallNow } from '../update-policy'

const base = {
  windowStart: '12:00', windowEnd: '13:00', autoInstall: true,
  pendingVersion: '1.0.10', targetVersion: '1.0.10',
  lastScanAt: null, idleMs: 2 * 60 * 1000,
}
const at = (h: number, m: number) => { const d = new Date(2026, 6, 20, h, m, 0); return d }

describe('shouldInstallNow', () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- update-policy`
Expected: FAIL — "shouldInstallNow is not a function"

- [ ] **Step 3: Write minimal implementation (append to update-policy.ts)**

```typescript
export interface InstallDecision {
  now: Date; windowStart: string; windowEnd: string; autoInstall: boolean
  pendingVersion: string | null; targetVersion: string | undefined
  lastScanAt: string | null; idleMs: number
}

function minutes(hhmm: string): number { const [h, m] = hhmm.split(':').map((n) => Number.parseInt(n, 10)); return (h || 0) * 60 + (m || 0) }

export function shouldInstallNow(p: InstallDecision): boolean {
  if (!p.autoInstall || !p.pendingVersion) return false
  if (shouldDownload(p.pendingVersion, p.targetVersion) === false) return false
  const cur = p.now.getHours() * 60 + p.now.getMinutes()
  if (cur < minutes(p.windowStart) || cur > minutes(p.windowEnd)) return false
  if (p.lastScanAt && p.now.getTime() - new Date(p.lastScanAt).getTime() < p.idleMs) return false
  return true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- update-policy`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/update-policy.ts src/main/__tests__/update-policy.test.ts
git commit -m "feat(updater): add pure should-install-now window+idle policy"
```

---

### Task 3: Parse target_version from heartbeat → store in config

**Files:**
- Modify: `src/main/sync/scheduler.ts:47-52` (heartbeat block in `syncNow`)
- Modify: `src/main/config.ts` (add `target_version` to `AppConfig`)

**Interfaces:**
- Consumes: `setConfigValue` (config.ts, existing)
- Produces: config key `target_version` (string) เก็บค่าล่าสุดจาก server; อ่านผ่าน `getConfigValue('target_version')`

- [ ] **Step 1: Add field to AppConfig**

ใน `src/main/config.ts` เพิ่มบรรทัดใน interface `AppConfig` (ใต้ `app_version?`):

```typescript
  app_version?: string
  target_version?: string   // server อนุญาตให้ติดตั้งได้ถึงเวอร์ชันนี้ (per-school) — sync จาก heartbeat
```

- [ ] **Step 2: Parse target_version in heartbeat**

ใน `src/main/sync/scheduler.ts` แก้ block heartbeat ใน `syncNow` (บรรทัด ~48-51) ให้ parse body:

```typescript
      const response = await apiFetchRaw('/api/device/heartbeat', { method: 'POST', body: { app_version: getConfig().app_version ?? app.getVersion() } })
      heartbeat = true
      const serverDate = response.headers.get('date')
      if (serverDate) clockSkew = { skew_ms: Date.now() - new Date(serverDate).getTime(), checked_at: new Date().toISOString() }
      try { const body = await response.json() as { target_version?: string }; if (typeof body?.target_version === 'string' && body.target_version) setConfigValue('target_version', body.target_version) } catch { /* server รุ่นเก่าไม่ส่ง body — คงค่าเดิม */ }
```

เพิ่ม import ที่หัวไฟล์: `setConfigValue` เข้าไปใน import จาก `'../config'` (บรรทัด 4 ปัจจุบัน `import { getConfig, isConfigured } from '../config'` → `import { getConfig, isConfigured, setConfigValue } from '../config'`).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/main/config.ts src/main/sync/scheduler.ts
git commit -m "feat(sync): read per-school target_version from heartbeat into config"
```

---

### Task 4: New config keys with defaults + safe-config exposure

**Files:**
- Modify: `src/main/config.ts` (AppConfig, DEFAULTS, SAFE_KEYS)

**Interfaces:**
- Produces config keys (string): `update_window_start` (default `"12:00"`), `update_window_end` (default `"13:00"`), `update_auto_install` (default `"true"`). ทั้งสาม + `target_version` + `app_version` อยู่ใน SAFE_KEYS ให้ renderer อ่านได้

- [ ] **Step 1: Add to AppConfig interface**

ใน `src/main/config.ts` interface `AppConfig` เพิ่มใต้ `auto_start: string`:

```typescript
  auto_start: string
  update_window_start: string
  update_window_end: string
  update_auto_install: string
  app_version?: string
```

- [ ] **Step 2: Add defaults**

แก้ object `DEFAULTS` เพิ่มค่า (ต่อท้ายก่อน `auto_start: 'false'` หรือหลังก็ได้ ขอให้อยู่ใน object):

```typescript
  kiosk_lock: 'false', tts_enabled: 'true', auto_start: 'false',
  update_window_start: '12:00', update_window_end: '13:00', update_auto_install: 'true'
```

- [ ] **Step 3: Expose in SAFE_KEYS**

แก้ array `SAFE_KEYS` เพิ่ม 4 key (target_version + 3 update keys) ต่อจาก `'app_version'`:

```typescript
const SAFE_KEYS = ['base_url', 'school_code', 'school_name', 'device_name', 'device_id', 'role', 'exit_after_hour', 'late_after', 'scan_cooldown_minutes', 'greeting_entry', 'greeting_exit', 'kiosk_lock', 'tts_enabled', 'auto_start', 'app_version', 'target_version', 'update_window_start', 'update_window_end', 'update_auto_install'] as const
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/config.ts
git commit -m "feat(config): add update window + auto-install keys, expose to renderer"
```

---

### Task 5: Wire policy into updater.ts (gated download + windowed install)

**Files:**
- Modify: `src/main/updater.ts` (whole file rewrite — keep dense style)

**Interfaces:**
- Consumes: `shouldDownload`, `shouldInstallNow`, `InstallDecision` (Tasks 1-2); `getConfig`, `getConfigValue` (config.ts); `getDb` (db/client)
- Produces: unchanged exports `initUpdater(win)`, `triggerInstall()` — behavior เปลี่ยนภายใน

- [ ] **Step 1: Rewrite updater.ts**

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Build to confirm main bundles**

Run: `npm run build`
Expected: build สำเร็จ ไม่มี error (electron-vite build → out/)

- [ ] **Step 4: Commit**

```bash
git add src/main/updater.ts
git commit -m "feat(updater): gate download by target_version + install in maintenance window"
```

---

### Task 6: Linux AppImage-only build

**Files:**
- Modify: `electron-builder.yml:11-17` (linux block)

**Interfaces:**
- Produces: Linux artifact เป็น AppImage เท่านั้น (auto-update ทำงาน); ตัด `deb`

- [ ] **Step 1: Edit electron-builder.yml linux target**

เปลี่ยน block `linux:` จาก:

```yaml
linux:
  artifactName: ${productName}.${ext}
  target:
    - AppImage
    - deb
  category: Education
  icon: resources/icon.png
```

เป็น:

```yaml
linux:
  artifactName: ${productName}.${ext}
  target:
    - AppImage
  category: Education
  icon: resources/icon.png
```

- [ ] **Step 2: Verify auto-launch uses AppImage path**

อ่าน `src/main/auto-launch.ts` — ยืนยันว่าใช้ `process.env.APPIMAGE` (หรือ `app.getPath('exe')`) เป็น path ไม่ hardcode `.deb` install location. ถ้าไม่ได้อ้าง APPIMAGE บน Linux ให้เพิ่ม: บน Linux ใช้ `process.env.APPIMAGE ?? execPath`.

Run: `grep -n "APPIMAGE\|execPath\|getPath" src/main/auto-launch.ts`
Expected: เห็นการอ้าง exec path — ถ้าไม่มีการแยกเคส APPIMAGE ให้แก้ให้ใช้ `process.env.APPIMAGE` ก่อนบน Linux

- [ ] **Step 3: Commit**

```bash
git add electron-builder.yml src/main/auto-launch.ts
git commit -m "build(linux): ship AppImage only so auto-update works"
```

---

### Task 7: Admin UI — update settings + status

**Files:**
- Modify: `src/renderer/pages/Admin.vue` (settings form + save + changelog array)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: safe config keys `update_window_start`, `update_window_end`, `update_auto_install`, `target_version`, `app_version` (Task 4); existing `admin.updateSettings(payload)` preload channel → `admin:settings:update` handler
- Produces: UI ให้แอดมินตั้งหน้าต่างเวลา + toggle auto-install; แสดง current version / target_version / pending

- [ ] **Step 1: Read current Admin.vue settings section**

Run: `grep -n "updateSettings\|app_version\|kiosk_lock\|auto_start\|เวอร์ชัน\|changelog\|version:" src/renderer/pages/Admin.vue`
อ่าน block รอบ ๆ ผลลัพธ์เพื่อ match รูปแบบ form + save ที่มีอยู่ (v-model, saveSettings payload)

- [ ] **Step 2: Add fields to settings form (Thai labels)**

ใน settings panel เพิ่ม (match รูปแบบ input เดิมของไฟล์):

```html
<label>หน้าต่างติดตั้งอัปเดต (เริ่ม)</label>
<input type="time" v-model="settings.update_window_start" />
<label>หน้าต่างติดตั้งอัปเดต (สิ้นสุด)</label>
<input type="time" v-model="settings.update_window_end" />
<label>ติดตั้งอัปเดตอัตโนมัติ</label>
<input type="checkbox" :checked="settings.update_auto_install === 'true'" @change="settings.update_auto_install = ($event.target as HTMLInputElement).checked ? 'true' : 'false'" />
<p class="hint">เวอร์ชันปัจจุบัน {{ settings.app_version }} · เซิร์ฟเวอร์อนุญาตถึง {{ settings.target_version || '—' }}</p>
```

- [ ] **Step 3: Ensure save payload includes new keys**

ในฟังก์ชัน save (เช่น `saveSettings`) ยืนยันว่า payload ส่ง `update_window_start`, `update_window_end`, `update_auto_install` ไปด้วย (ถ้า save ทั้ง object อยู่แล้วก็ครบ; ถ้า pick เป็น key ให้เพิ่ม 3 key นี้)

- [ ] **Step 4: Add changelog entry (both places, in sync)**

`CHANGELOG.md` — เพิ่ม section เวอร์ชันใหม่ (bump ตาม semver, เช่น `1.1.0`) ระบุ: auto-update ไร้คนดูแลในหน้าต่างเวลา, server คุม target_version, Linux AppImage-only.

`Admin.vue` changelog array — เพิ่ม entry เวอร์ชันเดียวกัน หัวข้อภาษาไทยตรงกัน (ดู memory: ต้อง sync ทั้งสองที่)

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS ทั้งคู่

- [ ] **Step 6: Commit**

```bash
git add src/renderer/pages/Admin.vue CHANGELOG.md
git commit -m "feat(admin): update-window settings + version status; changelog"
```

---

### Task 8: Server target_version — spec stub (โปรเจกต์ krudee)

**Files:**
- Create: `/Users/abcprintf/DATA/_serverAbcprintf/krudee` — แยก spec/PR (ไม่ทำใน repo นี้)

**Interfaces:**
- Produces: heartbeat endpoint (`POST /api/device/heartbeat`) response body มี field `target_version: string` ระดับ **per-school**; แอดมิน server ตั้งค่าได้ต่อโรงเรียน

- [ ] **Step 1: บันทึกเป็นงานแยก**

งานนี้อยู่คนละ repo — ใช้ skill `krudee-schema` (เพิ่ม field per-school) + `krudee-api` (ใส่ `target_version` ใน heartbeat response) เมื่อเริ่มโปรเจกต์ krudee. Kiosk (Task 3) มี fallback: ถ้า server ยังไม่ส่ง `target_version` → `shouldDownload` คืน false → ไม่มีอะไรติดตั้งจนกว่า server จะพร้อม (ปลอดภัย). ยืนยัน behavior นี้ยอมรับได้ก่อน deploy kiosk

- [ ] **Step 2: No commit** (repo นี้ไม่มีการเปลี่ยนแปลง)

---

## หมายเหตุการทดสอบ manual (หลัง implement)

- ตั้ง `target_version` ต่ำกว่า release ล่าสุด → kiosk ต้องไม่โหลด/ไม่ติดตั้ง (ดู log `updater`)
- ตั้ง `target_version` = release ล่าสุด + เลื่อนนาฬิกาเครื่องเข้าในหน้าต่างเวลา + ไม่มีการแตะบัตร 2 นาที → ต้อง quitAndInstall แล้วเปิดใหม่
- แตะบัตรภายใน 2 นาทีก่อนถึงเวลา → ต้องเลื่อนการติดตั้งไปรอบ cron ถัดไป
- ปิด `update_auto_install` → ปุ่ม "ติดตั้งตอนนี้" ใน banner ยัง force ได้
- Linux: build AppImage, จำลอง release ใหม่ → auto-update ทำงาน
