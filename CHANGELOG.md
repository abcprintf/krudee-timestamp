# Changelog

## [Unreleased]

### Added
- แท็บ "สรุปวันนี้" ในหน้า Admin — นักเรียนทั้งหมด/มาแล้ว/มาสาย/กลับแล้ว/ยังไม่มา แยกรายห้อง พร้อมเกณฑ์มาสายตั้งค่าได้ (`late_after`, ค่าเริ่มต้น 08:00)
- ตั้งค่าใหม่ในหน้า Admin: เวลาตัดเข้า/ออกสำหรับโหมด both (`exit_after_hour`), ระยะกันแตะซ้ำ (นาที), ข้อความทักทายเข้า/กลับ (รองรับ `{name}`), เปลี่ยน PIN ผู้ดูแล, ล็อกโหมดคีออสก์
- Sync ขึ้นเซิร์ฟเวอร์อัตโนมัติภายในไม่กี่วินาทีหลังแตะบัตร (debounce 8 วินาที) — ไม่ต้องรอรอบ cron 5 นาที
- ตรวจนาฬิกาเครื่องเทียบเซิร์ฟเวอร์ทุกรอบ heartbeat — เตือนในหน้า Admin ถ้าคลาดเกิน 2 นาที
- ป้ายสถานะออนไลน์/ออฟไลน์บนหน้า Kiosk + sync ทันทีเมื่อเน็ตกลับมา
- Log ไฟล์ production ที่ `userData/logs` (เก็บ 14 วัน) สำหรับ debug เครื่องหน้างาน
- Unit test ด้วย vitest (`npm test`) ครอบคลุมกติกาเข้า/ออก, cooldown, การอ่านผล sync

### Changed
- โหมด both: แตะครั้งแรกหลังเวลาตัด (ค่าเริ่มต้น 14:00) ถือว่า "กลับบ้าน" — เด็กที่ลืมแตะตอนเช้าจะไม่ถูกบันทึกผิดเป็น "เข้า" ตอนเย็น
- Attendance sync อ่านผลตอบจากเซิร์ฟเวอร์จริง (accepted/duplicates) — mark synced เฉพาะรายการที่เซิร์ฟเวอร์ยืนยัน
- ดึง roster แล้วลบนักเรียนที่หายไปจากเซิร์ฟเวอร์ (ย้าย/ลาออก) ออกจากเครื่อง พร้อมลบรูปที่ cache ไว้
- โหลดรูปนักเรียนเฉพาะที่เปลี่ยนหรือไฟล์หาย — ไม่โหลดทุกคนซ้ำทุก 30 นาที
- API client retry อัตโนมัติ 2 ครั้งพร้อม backoff เมื่อเน็ตสะดุด
- ค้นหานักเรียนจาก UID แบบ exact match ผ่าน `json_each` — ไม่ชนกันแบบ substring
- ลบ scan_events ที่ sync แล้วและเก่ากว่า 90 วันอัตโนมัติ — ฐานข้อมูลไม่บวม
- ปุ่มลัดเข้า Admin (Ctrl+Shift+A) ทำงานแม้ focus ไม่อยู่ที่ช่องสแกน

### Security
- PIN ผู้ดูแลเก็บเป็น scrypt hash แทน plain text (migrate อัตโนมัติจากเครื่องเดิม) + ล็อก 30 วินาทีเมื่อใส่ผิด 5 ครั้งติด
- `config:get` ส่งเฉพาะ key ที่จำเป็นให้ renderer — ไม่หลุด `device_token` / `setup_token` / PIN อีกต่อไป
- `admin:settings:update` รับเฉพาะ key ที่อนุญาต — renderer เขียนทับ token ไม่ได้

## [1.0.7] - 2026-07-17

### Added
- ทดสอบระบบ auto-update ครบวงจร — release นี้ใช้ยืนยันว่าเครื่องที่รัน 1.0.6 อัปเดตอัตโนมัติได้จริงทุกแพลตฟอร์ม (รวม macOS ที่ sign + notarize แล้ว)

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
