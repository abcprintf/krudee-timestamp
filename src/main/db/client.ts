import { app } from 'electron'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

let db: Database.Database | null = null

function resolveSchemaPath(): string {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? ''
  const candidates = [
    join(process.cwd(), 'src/main/db/schema.sql'),
    join(resourcesPath, 'schema.sql'),
    join(__dirname, 'db', 'schema.sql')
  ]
  const schemaPath = candidates.find((candidate) => existsSync(candidate))
  if (!schemaPath) throw new Error('SQLite schema.sql not found')
  return schemaPath
}

export function getDb(): Database.Database {
  if (db) return db
  const databasePath = join(app.getPath('userData'), 'krudee-timestamp.sqlite')
  mkdirSync(dirname(databasePath), { recursive: true })
  db = new Database(databasePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  const schemaPath = resolveSchemaPath()
  db.exec(readFileSync(schemaPath, 'utf8'))
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}
