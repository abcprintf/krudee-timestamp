# Changelog

## [1.0.6] - 2026-07-16

### Added
- เอกสาร `RELEASE.md` — ขั้นตอนออกเวอร์ชันใหม่และการตั้งค่า macOS code signing
- macOS: เพิ่ม `zip` target + hardened runtime + notarize config เพื่อรองรับ auto-update บน Mac
- CI: ส่ง signing secrets (CSC_LINK, APPLE_ID ฯลฯ) เข้า job build-mac

### Fixed
- ปิด auto-updater ใน dev mode (`app.isPackaged` guard) — ไม่มี error log ตอน `npm run dev`

## [1.0.5] - 2026-06-28

### Added
- QueueBadge แสดง countdown นับถอยหลังถึงรอบ sync อัตโนมัติถัดไป (ทุก 5 นาที)
- Dev logs ใน attendance sync — แสดง endpoint URL, รายการที่ส่ง, response และ error เฉพาะ mode development

### Fixed
- Attendance sync ไม่ส่ง request เมื่อคิวเป็น 0
- แก้ bug คิวค้างหลัง sync — mark synced ทุก event ทันทีที่ server ตอบกลับสำเร็จ (ไม่ติดปัญหา unknown_uids format mismatch)

## [1.0.4] - 2026-05-24

### Added
- README: เพิ่มหัวข้อ "เกี่ยวกับระบบครูดี" อธิบาย KruDee platform และลิงก์ https://krudee.workitdee.com/
- README: เพิ่ม section Hardware ที่ต้องการ — แนะนำ RFID reader และบัตรที่ใช้งานได้ พร้อม affiliate link
- README: เพิ่มภาษาอังกฤษควบคู่ภาษาไทยในส่วนหลัก

## [1.0.3] - 2026-05-24

### Added
- Student code input on Kiosk page as fallback when student forgets RFID card — an always-visible input field accepts both RFID keyboard-wedge output and manually typed student codes; backend falls back to `student_code` lookup when UID is not found in `rfid_uids`
- Changelog tab in Admin panel — shows version history directly in the app
- macOS build job added to GitHub Actions release workflow
- Contributing section in README — open for community contributions

### Fixed
- Footer version now correctly reflects `package.json` version by injecting `VITE_APP_VERSION` at build time via `electron.vite.config.ts`

## [1.0.1] - 2026-05-23

### Added
- Linux build job (AppImage + deb) in release workflow

### Fixed
- Grant `contents: write` permission in CI workflow so release assets can be uploaded
- Install `libudev-dev` on Linux runner before `npm ci` to fix `usb` native build

## [1.0.0] - 2026-05-23

### Added
- RFID keyboard-wedge scanning with 30-minute duplicate cooldown
- Entry/exit kind detection — supports `entry`, `exit`, and `both` kiosk roles
- Thai TTS greeting on scan (`espeak` / `say` / PowerShell `SpeechSynthesizer`)
- Local SQLite database (`config`, `students`, `scan_events` tables)
- Student roster sync every 30 minutes from KruDee server
- Attendance sync every 5 minutes with unsynced queue counter
- USB/HID RFID device monitor with live status in renderer
- Student photo served via `student-photo://` custom protocol
- Admin panel — PIN-protected, student search, unknown UID management, card bind/unbind
- Auto-update via `electron-updater` — checks on launch (+5 s) and every 4 hours, shows `UpdateBanner`
- Auto-launch on system startup (configurable)
- GitHub Actions CI — build and publish Windows (NSIS) and Linux (AppImage, deb) on release
- Version display in footer
