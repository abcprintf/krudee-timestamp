export interface CachedSpeechItem { key: string; text: string; path: string }
export async function getCachedSpeech(_text: string): Promise<CachedSpeechItem | null> { return null }
