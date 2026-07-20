# Kiosk Auto Update v2 — Design

วันที่: 2026-07-20
โปรเจกต์: krudee-timestamp (Electron kiosk) + krudee (server)
สถานะ: Draft — รอ implement

## ปัญหาที่จะแก้

ระบบ auto-update ปัจจุบัน (`electron-updater` + GitHub Releases) ทำงานถูกต้องระดับมาตรฐาน
แต่มีจุดอ่อนสำคัญในบริบท **kiosk โรงเรียนแบบไร้คนดูแล**:

1. **ติดตั้งเองไม่ได้** — kiosk เปิด full-screen ทั้งวัน ไม่มีแอดมินคอยกดปุ่ม "ติดตั้งตอนนี้"
   บนแบนเนอร์ (`autoInstallOnAppQuit = false`) → อัปเดตถูกดาวน์โหลดแต่ไม่เคยติดตั้ง
2. **ไม่มีการคุม rollout / rollback** — release ตัวใหม่ที่มีบั๊กจะกระจายไปทุกเครื่องพร้อมกัน
3. **Linux `.deb` ไม่ auto-update** — `electron-updater` อัปเดตได้เฉพาะ AppImage; `.deb` ที่ติดตั้งผ่าน
   apt/dpkg ต้องอัปเดตด้วยมือ

## เป้าหมาย

- kiosk อัปเดต + ติดตั้งเองได้ในหน้าต่างเวลาที่กำหนด โดยไม่รบกวนตอนนักเรียนแตะบัตร
- แอดมินคุม rollout ทีละล็อต และหยุด/ถอยเวอร์ชันที่พังได้จาก server เครื่องเดียว (ระดับ **ต่อโรงเรียน**)
- Linux auto-update ทำงานจริง

## ขอบเขต

- **In scope:** kiosk (Electron) ส่วนที่ 1–4, server ส่วนที่ 5
- **Out of scope (ครั้งนี้):** Windows code signing / SmartScreen, auto-rollback แบบตรวจ boot-crash,
  update channel (beta/stable)

---

## สถาปัตยกรรม

ยังใช้ `electron-updater` + GitHub Releases provider เดิม ไม่รื้อ CI/publish
เพิ่มกลไก 3 ชั้นทับเข้าไป + UI + server field

### ส่วนที่ 1 — Server-gated version (กันพัง, rollout ต่อโรงเรียน)

- **Server** เพิ่ม field `target_version` (semver string) ระดับ **ต่อโรงเรียน (per-school)** ส่งกลับมากับ
  response ที่ kiosk sync อยู่แล้ว (heartbeat / config pull ทุก 5 นาที)
- **Kiosk** parse `target_version` ใน `src/main/sync/response.ts` (มี unit test อยู่แล้ว — เพิ่ม test) →
  เก็บลง `config` table (key `target_version`)
- เปลี่ยน `autoUpdater.autoDownload = false`
- เมื่อ `update-available`: เทียบ semver — **ดาวน์โหลดเฉพาะเมื่อ `info.version <= target_version`**
  (ถ้าไม่มี `target_version` ใน config → fallback: ไม่ดาวน์โหลด เพื่อความปลอดภัย / หรือถือว่า "อนุญาต
  ล่าสุด" — **ตัดสินใจตอน implement**, default แนะนำ = ไม่ดาวน์โหลดจนกว่าจะมีค่า)
- ผล: GitHub มี 1.0.11 แต่ server ตั้ง target=1.0.10 → kiosk นิ่ง; แอดมิน bump target ต่อโรงเรียนเพื่อ
  rollout ทีละล็อต

**semver compare:** เขียน helper บริสุทธิ์ (pure, unit-tested) เทียบ `a.b.c` — ไม่ดึง dependency ใหม่ถ้าเลี่ยงได้

### ส่วนที่ 2 — Maintenance-window install (ติดตั้งไร้คนดูแล)

- config keys ใหม่ (เก็บใน `config` table เหมือน setting อื่น):
  - `update_window_start` — default `"12:00"`
  - `update_window_end` — default `"13:00"`
  - `update_auto_install` — bool, default `true`
- เมื่อ `update-downloaded`: **ไม่ติดตั้งทันที** ตั้ง state `pendingInstallVersion` ไว้ในหน่วยความจำ main
- cron เช็คทุก 1 นาที (เพิ่มใน `src/main/sync/scheduler.ts` หรือ updater เอง) — ติดตั้งเมื่อครบทุกเงื่อนไข:
  1. `update_auto_install` เปิด
  2. เวลาปัจจุบัน (local) อยู่ในช่วง `[window_start, window_end]`
  3. มี `pendingInstallVersion` รออยู่
  4. `pendingInstallVersion <= target_version` (เช็คซ้ำกันเคส target ถูกถอยหลังระหว่างรอ)
  5. **idle guard** — ไม่มีการแตะบัตร (scan) ใน 2 นาทีล่าสุด
- ครบเงื่อนไข → `autoUpdater.quitAndInstall()` แล้วแอปเปิดใหม่ (auto-launch เดิมพาเข้า kiosk)
- **idle guard** ต้องมี last-scan timestamp ให้ updater อ่านได้ (export จาก ipc/scan path)

### ส่วนที่ 3 — Linux AppImage อย่างเดียว

- `electron-builder.yml`: `linux.target` เหลือ `AppImage` (ตัด `deb` ออก)
- ตรวจ `src/main/auto-launch.ts` ให้ path ที่ auto-launch ใช้ชี้ไป AppImage ถูกต้อง (ตัวแปร env
  `APPIMAGE` ชี้ path จริงตอนรัน)
- อัปเดตเอกสาร deploy: เครื่อง Linux ใหม่ให้ใช้ AppImage

### ส่วนที่ 4 — Admin UI (`src/renderer/pages/Admin.vue`)

- เพิ่มฟิลด์ตั้งค่า: `update_window_start`, `update_window_end`, toggle `update_auto_install`
- แสดงสถานะ: current version, `target_version` (จาก server), สถานะ pending update (ถ้ามี)
- คงปุ่ม "ติดตั้งตอนนี้" ใน `UpdateBanner.vue` ไว้ ให้แอดมิน force ได้ทันที
- ต่อสายผ่าน `getSafeConfig()` / `setConfigValues()` + ipc channel เดิม (whitelist keys ใหม่)

### ส่วนที่ 5 — Server (โปรเจกต์ krudee)

- schema: เพิ่ม `target_version` ระดับโรงเรียน (per-school) — ตาม krudee-schema conventions
- API: ใส่ `target_version` ใน response ของ heartbeat/config endpoint ที่ kiosk เรียกอยู่แล้ว
- UI แอดมิน server (ถ้ามี): ให้ตั้ง `target_version` ต่อโรงเรียน
- แยก spec/PR ของโปรเจกต์ krudee เอง — งานนี้เป็น dependency ของส่วนที่ 1

---

## Error handling

- semver / target_version parse ล้มเหลว → log ผ่าน `logError`, ถือว่า "ไม่อนุญาตดาวน์โหลด" (ปลอดภัยไว้ก่อน)
- `quitAndInstall` ล้มเหลว → log, คง pending ไว้ ลองใหม่รอบ cron ถัดไปในหน้าต่างเวลา
- ออฟไลน์ / server ไม่ตอบ → ใช้ `target_version` ค่าล่าสุดที่ cache ไว้ใน config

## Testing

- **Pure unit tests (vitest):**
  - semver compare helper
  - เงื่อนไข "ควรดาวน์โหลดไหม" (version vs target)
  - เงื่อนไข "ควรติดตั้งตอนนี้ไหม" (window + pending + target + idle) — แยกเป็นฟังก์ชันบริสุทธิ์รับ
    (now, window, pendingVersion, targetVersion, lastScanAt) → boolean
  - parse `target_version` ใน `response.ts`
- ทดสอบมือ: จำลอง release ใหม่, ตั้ง target ต่ำกว่า → ต้องไม่ติดตั้ง; ตั้ง target เท่ากัน + อยู่ในหน้าต่าง →
  ติดตั้งตอน idle

## ลำดับงานที่แนะนำ

1. server: `target_version` per-school + API (โปรเจกต์ krudee)
2. kiosk: pure helpers + tests (semver, should-download, should-install)
3. kiosk: wire ใน `updater.ts` + parse ใน `response.ts` + config keys
4. kiosk: `electron-builder.yml` AppImage-only + auto-launch path
5. kiosk: Admin.vue UI + safe-config whitelist
6. อัปเดต CHANGELOG.md + Admin.vue changelog (ต้อง sync พร้อมกัน)
