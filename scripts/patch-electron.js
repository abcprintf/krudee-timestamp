// Patches Electron.app in node_modules to show correct app name on macOS Dock
// Run automatically via: npm run dev
// NOTE: ไม่ rename binary เพราะ electron-vite hardcode path ที่ MacOS/Electron
const { execSync } = require('child_process')
const { existsSync } = require('fs')
const { join } = require('path')

if (process.platform !== 'darwin') process.exit(0)

const APP_NAME = 'KruDee Timestamp'
const APP_DIR = join(__dirname, '../node_modules/electron/dist/Electron.app/Contents')
const PLIST = join(APP_DIR, 'Info.plist')

if (!existsSync(PLIST)) { console.log('Electron.app not found, skipping patch'); process.exit(0) }

try {
  const pb = (cmd) => execSync(`/usr/libexec/PlistBuddy -c "${cmd}" "${PLIST}"`, { stdio: 'ignore' })
  pb(`Set :CFBundleName ${APP_NAME}`)
  pb(`Set :CFBundleDisplayName ${APP_NAME}`)
  // CFBundleExecutable ต้องคงเป็น "Electron" เพื่อให้ electron-vite spawn ได้

  console.log(`✓ Electron.app patched → ${APP_NAME}`)
} catch (e) {
  console.warn('patch-electron skipped:', e.message)
}
