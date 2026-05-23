import { spawn } from 'node:child_process'
import { platform } from 'node:os'

export async function speakWithSystemVoice(text: string): Promise<void> {
  if (!text.trim()) return
  try {
    if (platform() === 'linux') { spawn('espeak', ['-v', 'th', text], { detached: true, stdio: 'ignore' }).unref(); return }
    if (platform() === 'darwin') {
      const child = spawn('say', ['-v', 'Kanya', text], { detached: true, stdio: 'ignore' })
      child.on('error', () => spawn('say', [text], { detached: true, stdio: 'ignore' }).unref())
      child.unref(); return
    }
    if (platform() === 'win32') {
      const escaped = text.replace(/'/g, "''")
      spawn('powershell.exe', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${escaped}')`], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    }
  } catch { /* TTS must never interrupt kiosk scanning. */ }
}
