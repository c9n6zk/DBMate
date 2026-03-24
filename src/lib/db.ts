import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.join(process.cwd(), 'data', 'dbmate.sqlite');

  // Ensure data directory exists
  const fs = require('fs');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent reads
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  initializeDatabase(db);

  return db;
}

function initializeDatabase(db: Database.Database): void {
  db.exec(`
    -- Importált sémák
    CREATE TABLE IF NOT EXISTS schemas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dialect TEXT NOT NULL CHECK(dialect IN ('mysql','postgresql','sqlite')),
      raw_sql TEXT NOT NULL,
      schema_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Séma verziók (undo/redo + timeline)
    CREATE TABLE IF NOT EXISTS schema_versions (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      schema_json TEXT NOT NULL,
      change_description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(schema_id, version_number)
    );

    -- Query history
    CREATE TABLE IF NOT EXISTS query_history (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
      nl_input TEXT NOT NULL,
      sql_output TEXT NOT NULL,
      explanation TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Migrációk
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
      version TEXT NOT NULL,
      name TEXT NOT NULL,
      up_sql TEXT NOT NULL,
      down_sql TEXT NOT NULL,
      description TEXT,
      format TEXT NOT NULL CHECK(format IN ('raw','flyway','liquibase','prisma')),
      applied_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(schema_id, version)
    );

    -- Chat üzenetek (per-schema)
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      sql TEXT,
      confidence TEXT CHECK(confidence IN ('high','medium','low')),
      type TEXT NOT NULL DEFAULT 'query' CHECK(type IN ('query','analysis','optimization','general')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_schema ON chat_messages(schema_id, created_at);

    -- App beállítások (singleton)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add confidence column to query_history if missing
  const qhColumns = db.pragma('table_info(query_history)') as { name: string }[];
  if (!qhColumns.some((c) => c.name === 'confidence')) {
    db.exec(`ALTER TABLE query_history ADD COLUMN confidence TEXT`);
  }

  // Migration: add table_count column if missing
  const columns = db.pragma('table_info(schemas)') as { name: string }[];
  if (!columns.some((c) => c.name === 'table_count')) {
    db.exec(`ALTER TABLE schemas ADD COLUMN table_count INTEGER NOT NULL DEFAULT 0`);
    // Backfill existing rows
    db.exec(`
      UPDATE schemas SET table_count = json_array_length(json_extract(schema_json, '$.tables'))
      WHERE table_count = 0
    `);
  }

  // Migration: add health_report column if missing
  if (!columns.some((c) => c.name === 'health_report')) {
    db.exec(`ALTER TABLE schemas ADD COLUMN health_report TEXT`);
  }
}
