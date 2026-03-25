import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// We test DB initialization logic directly using a temp database
// rather than importing getDb() which would create/modify the production DB

describe('Database Layer', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test_db_layer.sqlite');
  let db: Database.Database;

  beforeAll(() => {
    // Ensure data directory exists
    const dir = path.dirname(testDbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Remove any previous test DB
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

    db = new Database(testDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run same initialization as db.ts
    db.exec(`
      CREATE TABLE IF NOT EXISTS schemas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        dialect TEXT NOT NULL CHECK(dialect IN ('mysql','postgresql','sqlite')),
        raw_sql TEXT NOT NULL,
        schema_json TEXT NOT NULL,
        table_count INTEGER NOT NULL DEFAULT 0,
        health_report TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS schema_versions (
        id TEXT PRIMARY KEY,
        schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        schema_json TEXT NOT NULL,
        change_description TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(schema_id, version_number)
      );

      CREATE TABLE IF NOT EXISTS query_history (
        id TEXT PRIMARY KEY,
        schema_id TEXT NOT NULL REFERENCES schemas(id) ON DELETE CASCADE,
        nl_input TEXT NOT NULL,
        sql_output TEXT NOT NULL,
        explanation TEXT,
        confidence TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

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

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  });

  afterAll(() => {
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  describe('table creation', () => {
    it('creates all 6 tables', () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];
      const names = tables.map((t) => t.name).sort();
      expect(names).toEqual([
        'chat_messages',
        'migrations',
        'query_history',
        'schema_versions',
        'schemas',
        'settings',
      ]);
    });
  });

  describe('schemas table', () => {
    it('inserts and retrieves a schema', () => {
      db.prepare(
        `INSERT INTO schemas (id, name, dialect, raw_sql, schema_json, table_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).run('s1', 'Test', 'mysql', 'CREATE TABLE t (id INT);', '{"tables":[]}', 0);

      const row = db.prepare('SELECT * FROM schemas WHERE id = ?').get('s1') as any;
      expect(row.name).toBe('Test');
      expect(row.dialect).toBe('mysql');
    });

    it('enforces dialect CHECK constraint', () => {
      expect(() =>
        db.prepare(
          `INSERT INTO schemas (id, name, dialect, raw_sql, schema_json, table_count)
           VALUES ('bad', 'Bad', 'oracle', '', '{}', 0)`
        ).run()
      ).toThrow();
    });

    it('updates name and updated_at', () => {
      db.prepare("UPDATE schemas SET name = ?, updated_at = datetime('now') WHERE id = ?").run(
        'Renamed',
        's1'
      );
      const row = db.prepare('SELECT name FROM schemas WHERE id = ?').get('s1') as any;
      expect(row.name).toBe('Renamed');
    });
  });

  describe('foreign key cascade', () => {
    it('cascades delete to schema_versions', () => {
      db.prepare(
        `INSERT INTO schemas (id, name, dialect, raw_sql, schema_json, table_count) VALUES ('cascade1', 'CascadeTest', 'mysql', '', '{}', 0)`
      ).run();
      db.prepare(
        `INSERT INTO schema_versions (id, schema_id, version_number, schema_json, change_description)
         VALUES ('v1', 'cascade1', 1, '{}', 'test')`
      ).run();

      db.prepare('DELETE FROM schemas WHERE id = ?').run('cascade1');

      const versions = db.prepare('SELECT * FROM schema_versions WHERE schema_id = ?').all('cascade1');
      expect(versions).toHaveLength(0);
    });

    it('cascades delete to chat_messages', () => {
      db.prepare(
        `INSERT INTO schemas (id, name, dialect, raw_sql, schema_json, table_count) VALUES ('cascade2', 'ChatCascade', 'mysql', '', '{}', 0)`
      ).run();
      db.prepare(
        `INSERT INTO chat_messages (id, schema_id, role, content, type) VALUES ('cm1', 'cascade2', 'user', 'hello', 'query')`
      ).run();

      db.prepare('DELETE FROM schemas WHERE id = ?').run('cascade2');

      const msgs = db.prepare('SELECT * FROM chat_messages WHERE schema_id = ?').all('cascade2');
      expect(msgs).toHaveLength(0);
    });

    it('cascades delete to migrations', () => {
      db.prepare(
        `INSERT INTO schemas (id, name, dialect, raw_sql, schema_json, table_count) VALUES ('cascade3', 'MigCascade', 'mysql', '', '{}', 0)`
      ).run();
      db.prepare(
        `INSERT INTO migrations (id, schema_id, version, name, up_sql, down_sql, format) VALUES ('m1', 'cascade3', 'v1', 'test', 'UP', 'DOWN', 'raw')`
      ).run();

      db.prepare('DELETE FROM schemas WHERE id = ?').run('cascade3');

      const migs = db.prepare('SELECT * FROM migrations WHERE schema_id = ?').all('cascade3');
      expect(migs).toHaveLength(0);
    });
  });

  describe('schema_versions table', () => {
    it('enforces unique (schema_id, version_number)', () => {
      db.prepare(
        `INSERT INTO schemas (id, name, dialect, raw_sql, schema_json, table_count) VALUES ('sv1', 'VersionTest', 'mysql', '', '{}', 0)`
      ).run();
      db.prepare(
        `INSERT INTO schema_versions (id, schema_id, version_number, schema_json, change_description) VALUES ('sv1v1', 'sv1', 1, '{}', 'first')`
      ).run();

      expect(() =>
        db.prepare(
          `INSERT INTO schema_versions (id, schema_id, version_number, schema_json, change_description) VALUES ('sv1v1dup', 'sv1', 1, '{}', 'duplicate')`
        ).run()
      ).toThrow();
    });
  });

  describe('migrations table', () => {
    it('enforces unique (schema_id, version)', () => {
      db.prepare(
        `INSERT INTO schemas (id, name, dialect, raw_sql, schema_json, table_count) VALUES ('mt1', 'MigTest', 'mysql', '', '{}', 0)`
      ).run();
      db.prepare(
        `INSERT INTO migrations (id, schema_id, version, name, up_sql, down_sql, format) VALUES ('mig1', 'mt1', 'v001', 'first', 'UP', 'DOWN', 'raw')`
      ).run();

      expect(() =>
        db.prepare(
          `INSERT INTO migrations (id, schema_id, version, name, up_sql, down_sql, format) VALUES ('mig1dup', 'mt1', 'v001', 'dup', 'UP', 'DOWN', 'raw')`
        ).run()
      ).toThrow();
    });

    it('enforces format CHECK constraint', () => {
      expect(() =>
        db.prepare(
          `INSERT INTO migrations (id, schema_id, version, name, up_sql, down_sql, format) VALUES ('migbad', 'mt1', 'v999', 'bad', 'UP', 'DOWN', 'alembic')`
        ).run()
      ).toThrow();
    });
  });

  describe('chat_messages table', () => {
    it('enforces role CHECK constraint', () => {
      db.prepare(
        `INSERT INTO schemas (id, name, dialect, raw_sql, schema_json, table_count) VALUES ('cm_test', 'ChatTest', 'mysql', '', '{}', 0)`
      ).run();

      expect(() =>
        db.prepare(
          `INSERT INTO chat_messages (id, schema_id, role, content, type) VALUES ('cm_bad', 'cm_test', 'system', 'hello', 'query')`
        ).run()
      ).toThrow();
    });

    it('enforces confidence CHECK constraint', () => {
      expect(() =>
        db.prepare(
          `INSERT INTO chat_messages (id, schema_id, role, content, confidence, type) VALUES ('cm_bad2', 'cm_test', 'user', 'hi', 'very_high', 'query')`
        ).run()
      ).toThrow();
    });

    it('enforces type CHECK constraint', () => {
      expect(() =>
        db.prepare(
          `INSERT INTO chat_messages (id, schema_id, role, content, type) VALUES ('cm_bad3', 'cm_test', 'user', 'hi', 'unknown')`
        ).run()
      ).toThrow();
    });
  });

  describe('settings table', () => {
    it('inserts and retrieves settings', () => {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('theme', '"dark"');
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('theme') as any;
      expect(JSON.parse(row.value)).toBe('dark');
    });

    it('upserts on conflict', () => {
      db.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run('theme', '"light"');
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('theme') as any;
      expect(JSON.parse(row.value)).toBe('light');
    });
  });

  describe('WAL mode', () => {
    it('uses WAL journal mode', () => {
      const result = db.pragma('journal_mode') as { journal_mode: string }[];
      expect(result[0].journal_mode).toBe('wal');
    });
  });

  describe('transactions', () => {
    it('supports batch insert with transaction', () => {
      db.prepare(
        `INSERT INTO schemas (id, name, dialect, raw_sql, schema_json, table_count) VALUES ('tx1', 'TxTest', 'mysql', '', '{}', 0)`
      ).run();

      const insert = db.prepare(
        `INSERT INTO chat_messages (id, schema_id, role, content, type) VALUES (?, ?, ?, ?, ?)`
      );
      const batchInsert = db.transaction((msgs: string[][]) => {
        for (const m of msgs) insert.run(...m);
      });

      batchInsert([
        ['tx_m1', 'tx1', 'user', 'msg1', 'query'],
        ['tx_m2', 'tx1', 'assistant', 'msg2', 'query'],
        ['tx_m3', 'tx1', 'user', 'msg3', 'query'],
      ]);

      const count = db.prepare('SELECT COUNT(*) as c FROM chat_messages WHERE schema_id = ?').get('tx1') as any;
      expect(count.c).toBe(3);
    });
  });
});
