import AutoLaunch from 'auto-launch'
const launcher = new AutoLaunch({ name: 'KruDee Timestamp' })
export async function setAutoLaunch(enabled: boolean): Promise<void> { try { const current = await launcher.isEnabled(); if (enabled && !current) await launcher.enable(); if (!enabled && current) await launcher.disable() } catch (error) { console.error('Auto-launch update failed', error) } }
export async function getAutoLaunchEnabled(): Promise<boolean> { try { return await launcher.isEnabled() } catch { return false } }
