import { contextBridge, ipcRenderer } from 'electron'

const api = {
  config: { get: () => ipcRenderer.invoke('config:get') },
  setup: { register: (payload: unknown) => ipcRenderer.invoke('setup:register', payload) },
  scan: { record: (payload: { uid: string; scanned_at?: string }) => ipcRenderer.invoke('scan:record', payload), queueCount: () => ipcRenderer.invoke('scan:queue-count') },
  sync: { now: () => ipcRenderer.invoke('sync:now'), roster: () => ipcRenderer.invoke('roster:sync') },
  admin: {
    verifyPin: (pin: string) => ipcRenderer.invoke('admin:verify-pin', pin), students: (query?: string) => ipcRenderer.invoke('admin:students', query), unknownUids: () => ipcRenderer.invoke('admin:unknown-uids'),
    bindCard: (payload: { student_id: string; rfid_uid: string; label?: string }) => ipcRenderer.invoke('admin:bind-card', payload), unbindCard: (payload: { card_id: string }) => ipcRenderer.invoke('admin:unbind-card', payload),
    clearUnknownUids: () => ipcRenderer.invoke('admin:clear-unknown-uids'),
    deleteUnknownUid: (uid: string) => ipcRenderer.invoke('admin:delete-unknown-uid', uid),
    updateSettings: (payload: Record<string, string>) => ipcRenderer.invoke('admin:settings:update', payload), history: () => ipcRenderer.invoke('admin:history'), resetDevice: () => ipcRenderer.invoke('admin:reset-device')
  }
}
contextBridge.exposeInMainWorld('krudee', api)
