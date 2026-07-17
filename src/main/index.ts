import { app, BrowserWindow, protocol, screen } from 'electron'
import { join } from 'node:path'
import { platform } from 'node:os'
import { closeDb, getDb } from './db/client'
import { registerIpcHandlers } from './ipc'
import { registerStudentPhotoProtocol } from './photos'
import { startScheduler, stopScheduler } from './sync/scheduler'
import { getConfig } from './config'
import { setAutoLaunch } from './auto-launch'
import { initUpdater } from './updater'

app.setName('KruDee Timestamp')
if (process.platform === 'win32') app.setAppUserModelId('app.krudee.timestamp')

protocol.registerSchemesAsPrivileged([{ scheme: 'student-photo', privileges: { standard: true, secure: true, supportFetchAPI: true } }])
let mainWindow: BrowserWindow | null = null

function getIconPath(): string {
  const os = platform()
  if (os === 'win32') return join(__dirname, '../../resources/icon.ico')
  if (os === 'darwin') return join(__dirname, '../../resources/icon.icns')
  return join(__dirname, '../../resources/icon.png')
}

function createWindow(): void {
  const primary = screen.getPrimaryDisplay()
  const { x, y, width, height } = primary.bounds
  mainWindow = new BrowserWindow({ x, y, width, height, minWidth: 1024, minHeight: 640, autoHideMenuBar: true, backgroundColor: '#f8fafc', icon: getIconPath(), webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false, contextIsolation: true, nodeIntegration: false } })
  // ต้อง setBounds ก่อน setFullScreen — fullscreen: true ใน constructor จะ ignore x,y
  mainWindow.setBounds(primary.bounds)
  mainWindow.setFullScreen(true)
  if (getConfig().kiosk_lock === 'true') mainWindow.setKiosk(true)
  mainWindow.on('closed', () => { mainWindow = null })
  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin' && app.dock) app.dock.setIcon(join(__dirname, '../../resources/icon.png'))
  getDb(); registerStudentPhotoProtocol(); registerIpcHandlers(); startScheduler()
  if (getConfig().auto_start === 'true') await setAutoLaunch(true)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  createWindow()
  if (mainWindow) initUpdater(mainWindow)
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => { stopScheduler(); closeDb() })
