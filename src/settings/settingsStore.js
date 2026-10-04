import { DatabaseSync } from "node:sqlite";
import { DEFAULT_SETTINGS, PATHS } from "../config/defaults.js";

export class SettingsStore {
  constructor(dbPath = PATHS.settingsDb) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    this.upsertStmt = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    this.insertIfMissingStmt = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO NOTHING
    `);

    this.getStmt = this.db.prepare("SELECT value FROM settings WHERE key = ?");
  }

  set(key, value) {
    this.upsertStmt.run(key, String(value));
  }

  get(key) {
    const row = this.getStmt.get(key);
    return row?.value;
  }

  getNumber(key) {
    const value = this.get(key);
    if (value === undefined || value === null || value === "") return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  initDefaults(defaults = DEFAULT_SETTINGS) {
    for (const [key, value] of Object.entries(defaults)) {
      this.insertIfMissingStmt.run(key, String(value));
    }
  }
}

export function createSettingsStore(dbPath) {
  const store = new SettingsStore(dbPath);
  store.initDefaults();
  return store;
}
