import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { estimateConfidence, isProxyMode } from '../ai-service';
import type { Schema } from '../types';

function makeSchema(tableNames: string[]): Schema {
  return {
    id: 'test',
    name: 'test',
    dialect: 'mysql',
    tables: tableNames.map((name) => ({
      name,
      columns: [{ name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true, unique: false }],
      primaryKey: ['id'],
      foreignKeys: [],
      indexes: [],
    })),
    createdAt: '',
    updatedAt: '',
    rawSQL: '',
  };
}

describe('estimateConfidence', () => {
  const schema = makeSchema(['users', 'orders', 'products']);

  it('returns high for simple single-table query', () => {
    expect(estimateConfidence('SELECT * FROM users', schema)).toBe('high');
  });

  it('returns medium for query with 1-2 JOINs', () => {
    expect(
      estimateConfidence('SELECT * FROM users JOIN orders ON users.id = orders.user_id', schema)
    ).toBe('medium');
  });

  it('returns low for query with >2 JOINs', () => {
    const sql =
      'SELECT * FROM users JOIN orders ON users.id = orders.user_id ' +
      'JOIN products ON orders.product_id = products.id ' +
      'JOIN categories ON products.category_id = categories.id';
    expect(estimateConfidence(sql, schema)).toBe('low');
  });

  it('returns low for subquery', () => {
    expect(
      estimateConfidence('SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)', schema)
    ).toBe('low');
  });

  it('returns low for unknown table reference', () => {
    expect(estimateConfidence('SELECT * FROM nonexistent_table', schema)).toBe('low');
  });

  it('returns high for simple WHERE clause', () => {
    expect(
      estimateConfidence("SELECT name FROM users WHERE id = 1", schema)
    ).toBe('high');
  });
});

describe('isProxyMode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns false when ANTHROPIC_BASE_URL is not set', () => {
    delete process.env.ANTHROPIC_BASE_URL;
    expect(isProxyMode()).toBe(false);
  });

  it('returns false when ANTHROPIC_BASE_URL is api.anthropic.com', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
    expect(isProxyMode()).toBe(false);
  });

  it('returns true when ANTHROPIC_BASE_URL is localhost proxy', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:42069';
    expect(isProxyMode()).toBe(true);
  });

  it('returns true for any non-anthropic base URL', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://custom-proxy.local:8080';
    expect(isProxyMode()).toBe(true);
  });
});
