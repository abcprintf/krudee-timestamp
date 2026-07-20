import AutoLaunch from 'auto-launch'
// บน Linux ต้องใช้ path ของ AppImage เอง — process.execPath คือ mount path ชั่วคราวที่เปลี่ยนทุกครั้งที่รัน
const launcher = new AutoLaunch({ name: 'KruDee Timestamp', path: process.env.APPIMAGE })
export async function setAutoLaunch(enabled: boolean): Promise<void> { try { const current = await launcher.isEnabled(); if (enabled && !current) await launcher.enable(); if (!enabled && current) await launcher.disable() } catch (error) { console.error('Auto-launch update failed', error) } }
export async function getAutoLaunchEnabled(): Promise<boolean> { try { return await launcher.isEnabled() } catch { return false } }
