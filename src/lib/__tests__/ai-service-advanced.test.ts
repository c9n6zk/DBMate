import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isProxyMode, createAnthropicClient, systemPrompt, estimateConfidence } from '../ai-service';
import type { Schema } from '../types';

function makeSchema(tableNames: string[]): Schema {
  return {
    id: 'test',
    name: 'test',
    dialect: 'mysql',
    tables: tableNames.map((name) => ({
      name,
      columns: [
        { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true, unique: false },
      ],
      primaryKey: ['id'],
      foreignKeys: [],
      indexes: [],
    })),
    createdAt: '',
    updatedAt: '',
    rawSQL: '',
  };
}

describe('AI Service - Advanced', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createAnthropicClient', () => {
    it('creates client with proxy base URL', () => {
      process.env.ANTHROPIC_BASE_URL = 'http://localhost:42069';
      const client = createAnthropicClient();
      expect(client).toBeDefined();
    });

    it('throws when no API key and no base URL', () => {
      delete process.env.ANTHROPIC_BASE_URL;
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => createAnthropicClient()).toThrow('ANTHROPIC_API_KEY is not configured');
    });

    it('throws with placeholder API key', () => {
      delete process.env.ANTHROPIC_BASE_URL;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-your-key-here';
      expect(() => createAnthropicClient()).toThrow('ANTHROPIC_API_KEY is not configured');
    });

    it('creates client with valid API key', () => {
      delete process.env.ANTHROPIC_BASE_URL;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-real-key-12345';
      const client = createAnthropicClient();
      expect(client).toBeDefined();
    });
  });

  describe('systemPrompt', () => {
    it('returns text block array without cache', () => {
      const result = systemPrompt('Test prompt');
      expect(result).toEqual([{ type: 'text', text: 'Test prompt' }]);
    });

    it('adds cache_control when withCache=true and NOT in proxy mode', () => {
      delete process.env.ANTHROPIC_BASE_URL;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-real-key';
      const result = systemPrompt('Test prompt', true);
      expect(result).toEqual([
        { type: 'text', text: 'Test prompt', cache_control: { type: 'ephemeral' } },
      ]);
    });

    it('does NOT add cache_control in proxy mode', () => {
      process.env.ANTHROPIC_BASE_URL = 'http://localhost:42069';
      const result = systemPrompt('Test prompt', true);
      expect(result).toEqual([{ type: 'text', text: 'Test prompt' }]);
    });
  });

  describe('estimateConfidence - edge cases', () => {
    const schema = makeSchema(['users', 'orders', 'products', 'categories']);

    it('handles INSERT statements as high confidence', () => {
      expect(estimateConfidence("INSERT INTO users VALUES (1, 'test')", schema)).toBe('high');
    });

    it('handles UPDATE statements as high confidence', () => {
      expect(estimateConfidence("UPDATE users SET name = 'test' WHERE id = 1", schema)).toBe('high');
    });

    it('handles DELETE statements as high confidence', () => {
      expect(estimateConfidence('DELETE FROM users WHERE id = 1', schema)).toBe('high');
    });

    it('returns low for query referencing missing table among valid ones', () => {
      const sql = 'SELECT * FROM users JOIN missing_table ON users.id = missing_table.user_id';
      expect(estimateConfidence(sql, schema)).toBe('low');
    });

    it('returns medium for exactly 2 JOINs', () => {
      const sql =
        'SELECT * FROM users JOIN orders ON users.id = orders.user_id ' +
        'JOIN products ON orders.product_id = products.id';
      expect(estimateConfidence(sql, schema)).toBe('medium');
    });

    it('handles LEFT JOIN same as JOIN', () => {
      const sql = 'SELECT * FROM users LEFT JOIN orders ON users.id = orders.user_id';
      expect(estimateConfidence(sql, schema)).toBe('medium');
    });

    it('returns low for deeply nested subquery', () => {
      const sql =
        'SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE total > (SELECT AVG(total) FROM orders))';
      expect(estimateConfidence(sql, schema)).toBe('low');
    });

    it('returns high for empty schema (no table refs to check)', () => {
      const emptySchema = makeSchema([]);
      // No FROM clause → no unknowns, no JOINs → high
      expect(estimateConfidence('SELECT 1', emptySchema)).toBe('high');
    });

    it('handles quoted table names', () => {
      expect(estimateConfidence('SELECT * FROM `users`', schema)).toBe('high');
    });
  });
});
