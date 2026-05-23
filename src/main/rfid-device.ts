import { BrowserWindow } from 'electron'
import { WebUSB, getDeviceList } from 'usb'
import type { Device } from 'usb'

export interface RfidDeviceStatus {
  connected: boolean
  count: number
}

function isHidKeyboard(device: Device): boolean {
  try {
    const interfaces = device.configDescriptor?.interfaces ?? []
    return interfaces.some(ifc =>
      ifc.some(alt => alt.bInterfaceClass === 3 && alt.bInterfaceProtocol === 1)
    )
  } catch {
    return false
  }
}

function getStatus(): RfidDeviceStatus {
  const devices = getDeviceList()
  const count = devices.filter(isHidKeyboard).length
  return { connected: count > 0, count }
}

function broadcast(status: RfidDeviceStatus): void {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) win.webContents.send('rfid-device-changed', status)
  })
}

export function initRfidDeviceMonitor(): RfidDeviceStatus {
  const webusb = new WebUSB({ allowAllDevices: true })
  webusb.addEventListener('connect', () => broadcast(getStatus()))
  webusb.addEventListener('disconnect', () => broadcast(getStatus()))
  return getStatus()
}

export { getStatus as getRfidDeviceStatus }
