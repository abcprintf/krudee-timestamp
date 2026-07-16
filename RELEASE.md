# Release Guide — ขั้นตอนการออกเวอร์ชันใหม่

Auto-update ทำงานผ่าน `electron-updater` + GitHub Releases โดยอัตโนมัติ:
เครื่อง kiosk จะเช็คเวอร์ชันใหม่ **5 วินาทีหลังเปิดแอป** และ **ทุก 4 ชั่วโมง**
ถ้ามีเวอร์ชันใหม่จะดาวน์โหลดอัตโนมัติ แล้วแสดง banner ให้กด "ติดตั้งและรีสตาร์ท"

## ขั้นตอน release (How to release)

1. **Bump version** ใน `package.json` เช่น `1.0.5` → `1.0.6`
2. **อัปเดต changelog ทั้ง 2 ที่** (กติกาของ repo นี้ — ต้องตรงกันเสมอ)
   - `CHANGELOG.md`
   - array changelog ใน `src/renderer/pages/Admin.vue` (ภาษาไทย + พ.ศ.)
3. **Commit + push** ขึ้น `main` (ผ่าน PR ตามปกติ)
4. **สร้าง tag และ GitHub Release**
   ```bash
   git tag v1.0.6
   git push origin v1.0.6
   gh release create v1.0.6 --title "v1.0.6" --notes "ดู CHANGELOG.md"
   ```
   > workflow `Build on Release` (.github/workflows/build.yml) จะ trigger เมื่อ **สร้าง Release** (ไม่ใช่แค่ push tag)
5. **รอ CI build** (~10-20 นาที) — 3 jobs: Windows / Linux / macOS
   เสร็จแล้ว Release assets ต้องมี:
   - `*.exe` + `latest.yml` (Windows)
   - `*.AppImage`, `*.deb` + `latest-linux.yml` (Linux)
   - `*.dmg`, `*.zip` + `latest-mac.yml` (macOS)
6. **เครื่อง kiosk อัปเดตเอง** — ไม่ต้องทำอะไรที่หน้างาน

ตรวจสถานะ CI: `gh run list --workflow=build.yml`

## Platform notes

| OS | Installer | Auto-update |
|---|---|---|
| Windows | NSIS `.exe` | ✅ ทำงานทันที |
| Linux | AppImage | ✅ (เฉพาะ AppImage — `.deb` ต้องอัปเดตมือ) |
| macOS | `.dmg` / `.zip` | ✅ **ต้อง code sign + notarize** (ดูด้านล่าง) |

## macOS signing setup (ทำครั้งเดียว)

electron-updater บน macOS ต้องการแอปที่ sign ด้วย Developer ID และ notarize แล้วเท่านั้น
ถ้ายังไม่ได้ตั้ง secrets — build จะยังผ่าน แต่ Mac จะอัปเดตอัตโนมัติไม่ได้ (ติดตั้ง dmg มือแทน)

1. สมัคร [Apple Developer Program](https://developer.apple.com/programs/) ($99/ปี)
2. สร้าง certificate ชนิด **Developer ID Application** ใน Xcode หรือ developer.apple.com
3. Export เป็น `.p12` (ตั้งรหัสผ่าน) แล้วแปลงเป็น base64:
   ```bash
   base64 -i DeveloperID.p12 | pbcopy
   ```
4. สร้าง app-specific password ที่ [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security
5. ตั้ง GitHub secrets (Settings → Secrets and variables → Actions):

   | Secret | ค่า |
   |---|---|
   | `CSC_LINK` | base64 ของไฟล์ .p12 |
   | `CSC_KEY_PASSWORD` | รหัสผ่าน .p12 |
   | `APPLE_ID` | Apple ID email |
   | `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password |
   | `APPLE_TEAM_ID` | Team ID (ดูใน developer.apple.com → Membership) |

## Troubleshooting

- **kiosk ไม่อัปเดต**: เช็คว่า Release มีไฟล์ `latest*.yml` ครบ, เครื่องต่อเน็ต, และแอปเป็นเวอร์ชัน packaged (dev mode ปิด updater)
- **Mac ขึ้น error signature**: แอปเก่าบนเครื่องต้องเป็น build ที่ sign แล้วเหมือนกัน — ถ้าเครื่องมี build unsigned อยู่ ให้ลงใหม่จาก dmg ที่ sign แล้วหนึ่งครั้ง
- ดู log updater ได้จาก console ของ main process (`[updater] error:`)
