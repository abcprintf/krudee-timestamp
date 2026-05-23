# Changelog

## [Unreleased]

### Added
- Student code input on Kiosk page as fallback when student forgets RFID card — an always-visible input field accepts both RFID keyboard-wedge output and manually typed student codes; backend falls back to `student_code` lookup when UID is not found in `rfid_uids`

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
