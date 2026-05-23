# Changelog

## [Unreleased]

## [1.0.1] - 2026-05-23

### Fixed
- Grant `contents: write` permission in CI workflow so release assets can be uploaded
- Add Linux build job to release workflow

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
