import { describe, it, expect } from 'vitest';
import { validateSeedSQL } from '../seed-validator';
import type { Schema, Column, Table } from '../types';

function col(name: string, overrides: Partial<Column> = {}): Column {
  return {
    name,
    type: 'INT',
    nullable: true,
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    ...overrides,
  };
}

function makeSchema(tables: Table[]): Schema {
  return {
    id: 'test',
    name: 'test',
    dialect: 'mysql',
    tables,
    createdAt: '',
    updatedAt: '',
    rawSQL: '',
  };
}

describe('validateSeedSQL', () => {
  const usersTable: Table = {
    name: 'users',
    columns: [
      col('id', { primaryKey: true, autoIncrement: true, nullable: false }),
      col('name', { type: 'VARCHAR(100)', nullable: false }),
      col('email', { type: 'VARCHAR(255)', nullable: false }),
      col('bio', { type: 'TEXT' }),
    ],
    primaryKey: ['id'],
    foreignKeys: [],
    indexes: [],
  };

  it('accepts valid INSERT with correct columns', () => {
    const sql = "INSERT INTO users (name, email) VALUES ('Alice', 'alice@test.com');";
    const result = validateSeedSQL(sql, makeSchema([usersTable]));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects unknown column names', () => {
    const sql = "INSERT INTO users (name, nonexistent) VALUES ('Alice', 'x');";
    const result = validateSeedSQL(sql, makeSchema([usersTable]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('nonexistent'))).toBe(true);
  });

  it('warns about missing NOT NULL columns', () => {
    const sql = "INSERT INTO users (name) VALUES ('Alice');";
    const result = validateSeedSQL(sql, makeSchema([usersTable]));
    // email is NOT NULL and not auto-increment, should warn
    expect(result.warnings.some((w) => w.includes('email'))).toBe(true);
  });

  it('does not warn about auto-increment columns', () => {
    const sql = "INSERT INTO users (name, email) VALUES ('Alice', 'a@b.com');";
    const result = validateSeedSQL(sql, makeSchema([usersTable]));
    // id is auto-increment, should not warn
    expect(result.warnings.filter((w) => w.includes('"id"'))).toHaveLength(0);
  });

  it('warns on INSERT without column list', () => {
    const sql = "INSERT INTO users VALUES (1, 'Alice', 'a@b.com', 'bio');";
    const result = validateSeedSQL(sql, makeSchema([usersTable]));
    expect(result.warnings.some((w) => w.includes('without column list'))).toBe(true);
  });

  it('handles multiple INSERT statements', () => {
    const sql = `
      INSERT INTO users (name, email) VALUES ('Alice', 'a@b.com');
      INSERT INTO users (name, bad_col) VALUES ('Bob', 'x');
    `;
    const result = validateSeedSQL(sql, makeSchema([usersTable]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('bad_col'))).toBe(true);
  });

  it('returns valid for empty SQL (no matching inserts)', () => {
    const result = validateSeedSQL('SELECT 1;', makeSchema([usersTable]));
    expect(result.valid).toBe(true);
  });

  it('handles columns with default values (not required)', () => {
    const tableWithDefaults: Table = {
      name: 'posts',
      columns: [
        col('id', { primaryKey: true, autoIncrement: true, nullable: false }),
        col('title', { type: 'VARCHAR(200)', nullable: false }),
        col('status', { type: 'VARCHAR(20)', nullable: false, defaultValue: "'draft'" }),
      ],
      primaryKey: ['id'],
      foreignKeys: [],
      indexes: [],
    };
    const sql = "INSERT INTO posts (title) VALUES ('Hello');";
    const result = validateSeedSQL(sql, makeSchema([tableWithDefaults]));
    // status has default, should not warn
    expect(result.warnings.filter((w) => w.includes('status'))).toHaveLength(0);
  });
});
