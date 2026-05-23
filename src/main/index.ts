import { app, BrowserWindow, protocol } from 'electron'
import { join } from 'node:path'
import { closeDb, getDb } from './db/client'
import { registerIpcHandlers } from './ipc'
import { registerStudentPhotoProtocol } from './photos'
import { startScheduler, stopScheduler } from './sync/scheduler'
import { getConfig } from './config'
import { setAutoLaunch } from './auto-launch'

protocol.registerSchemesAsPrivileged([{ scheme: 'student-photo', privileges: { standard: true, secure: true, supportFetchAPI: true } }])
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({ width: 1280, height: 800, minWidth: 1024, minHeight: 640, fullscreen: true, autoHideMenuBar: true, backgroundColor: '#f8fafc', webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false, contextIsolation: true, nodeIntegration: false } })
  mainWindow.on('closed', () => { mainWindow = null })
  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  getDb(); registerStudentPhotoProtocol(); registerIpcHandlers(); startScheduler()
  if (getConfig().auto_start === 'true') await setAutoLaunch(true)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  createWindow()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => { stopScheduler(); closeDb() })
