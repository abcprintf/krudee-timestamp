import { contextBridge, ipcRenderer } from 'electron'

const api = {
  config: { get: () => ipcRenderer.invoke('config:get') },
  setup: { register: (payload: unknown) => ipcRenderer.invoke('setup:register', payload) },
  scan: { record: (payload: { uid: string; scanned_at?: string }) => ipcRenderer.invoke('scan:record', payload), queueCount: () => ipcRenderer.invoke('scan:queue-count') },
  sync: { now: () => ipcRenderer.invoke('sync:now'), roster: () => ipcRenderer.invoke('roster:sync') },
  device: {
    rfidStatus: () => ipcRenderer.invoke('device:rfid-status'),
    onRfidStatusChange: (cb: (status: { connected: boolean; count: number }) => void) => {
      const listener = (_: unknown, status: { connected: boolean; count: number }) => cb(status)
      ipcRenderer.on('rfid-device-changed', listener)
      return () => ipcRenderer.off('rfid-device-changed', listener)
    },
  },
  admin: {
    verifyPin: (pin: string) => ipcRenderer.invoke('admin:verify-pin', pin), students: (query?: string) => ipcRenderer.invoke('admin:students', query), unknownUids: () => ipcRenderer.invoke('admin:unknown-uids'),
    bindCard: (payload: { student_id: string; rfid_uid: string; label?: string }) => ipcRenderer.invoke('admin:bind-card', payload), unbindCard: (payload: { card_id: string }) => ipcRenderer.invoke('admin:unbind-card', payload),
    clearUnknownUids: () => ipcRenderer.invoke('admin:clear-unknown-uids'),
    deleteUnknownUid: (uid: string) => ipcRenderer.invoke('admin:delete-unknown-uid', uid),
    updateSettings: (payload: Record<string, string>) => ipcRenderer.invoke('admin:settings:update', payload), history: () => ipcRenderer.invoke('admin:history'), resetDevice: () => ipcRenderer.invoke('admin:reset-device')
  },
  updater: {
    onUpdateAvailable: (cb: (info: { version: string; releaseNotes: string | null }) => void) => {
      const listener = (_: unknown, info: { version: string; releaseNotes: string | null }) => cb(info)
      ipcRenderer.on('updater:update-available', listener)
      return () => ipcRenderer.off('updater:update-available', listener)
    },
    onDownloadProgress: (cb: (progress: { percent: number }) => void) => {
      const listener = (_: unknown, progress: { percent: number }) => cb(progress)
      ipcRenderer.on('updater:download-progress', listener)
      return () => ipcRenderer.off('updater:download-progress', listener)
    },
    onUpdateDownloaded: (cb: (info: { version: string }) => void) => {
      const listener = (_: unknown, info: { version: string }) => cb(info)
      ipcRenderer.on('updater:update-downloaded', listener)
      return () => ipcRenderer.off('updater:update-downloaded', listener)
    },
    install: () => ipcRenderer.invoke('updater:install'),
  },
}
contextBridge.exposeInMainWorld('krudee', api)
