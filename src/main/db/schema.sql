CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  student_code TEXT,
  prefix TEXT,
  first_name TEXT,
  last_name TEXT,
  nickname TEXT,
  photo_url TEXT,
  photo_local_path TEXT,
  classroom_name TEXT,
  class_number INTEGER,
  rfid_uids TEXT,
  rfid_cards TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_students_uids ON students(rfid_uids);
CREATE TABLE IF NOT EXISTS scan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_event_id TEXT UNIQUE NOT NULL,
  rfid_uid TEXT NOT NULL,
  scanned_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  matched_student_id TEXT,
  synced INTEGER DEFAULT 0,
  sync_error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scan_events_synced ON scan_events(synced);
