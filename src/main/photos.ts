import { app, net, protocol } from 'electron'
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { getDb } from './db/client'

export function getPhotosDir(): string { const dir = join(app.getPath('userData'), 'photos'); mkdirSync(dir, { recursive: true }); return dir }
export function getPhotoPath(studentId: string): string { return join(getPhotosDir(), `${studentId}.jpg`) }

export function registerStudentPhotoProtocol(): void {
  protocol.handle('student-photo', async (request) => {
    const url = new URL(request.url)
    const studentId = decodeURIComponent(url.hostname || url.pathname.replace(/^\//, ''))
    if (!studentId) return new Response(null, { status: 404 })
    const row = getDb().prepare('SELECT photo_local_path FROM students WHERE id = ?').get(studentId) as { photo_local_path: string | null } | undefined
    const localPath = row?.photo_local_path || getPhotoPath(studentId)
    return existsSync(localPath) ? net.fetch(pathToFileURL(localPath).toString()) : new Response(null, { status: 404 })
  })
}

export async function downloadStudentPhoto(studentId: string, photoUrl?: string | null): Promise<string | null> {
  if (!photoUrl) return null
  try {
    const response = await net.fetch(photoUrl)
    if (!response.ok || !response.body) return null
    const localPath = getPhotoPath(studentId)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(localPath))
    getDb().prepare('UPDATE students SET photo_local_path = ? WHERE id = ?').run(localPath, studentId)
    return localPath
  } catch { return null }
}
