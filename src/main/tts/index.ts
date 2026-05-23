import { getConfig } from '../config'
import { speakWithSystemVoice } from './system-driver'
export async function speak(text: string): Promise<void> { if (getConfig().tts_enabled !== 'false') await speakWithSystemVoice(text) }
