import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./appSettings.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

const upsertStmt = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const insertIfMissingStmt = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO NOTHING
`);

export function setSetting(key, value) {
  upsertStmt.run(key, String(value));
}

const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');

export function getSetting(key) {
  const row = getStmt.get(key);
  return row?.value;
}

export function initDefaults(defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    insertIfMissingStmt.run(key, String(value));
  }
}

initDefaults({
  mpd_host: "localhost",
  mpd_port: 6600,
  mpd_unix: "/run/user/1000/mpd/socket",
})