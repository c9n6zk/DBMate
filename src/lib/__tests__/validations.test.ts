import { describe, it, expect } from 'vitest';
import {
  parseRequestSchema,
  queryRequestSchema,
  analyzeRequestSchema,
  migrateRequestSchema,
  seedRequestSchema,
  explainRequestSchema,
  createSchemaRequestSchema,
  updateSchemaRequestSchema,
  updateSettingsSchema,
  saveChatSchema,
  chatQuerySchema,
  chatDeleteSchema,
  dialectSchema,
  migrationFormatSchema,
  severitySchema,
  aiNormalizationResultSchema,
  aiMigrationResultSchema,
  MAX_SQL_INPUT_SIZE,
  MAX_CHAT_MESSAGE_LENGTH,
  AI_RATE_LIMIT,
  MAX_CHAT_HISTORY,
} from '../validations';

describe('validations', () => {
  describe('constants', () => {
    it('has correct values', () => {
      expect(MAX_SQL_INPUT_SIZE).toBe(500_000);
      expect(MAX_CHAT_MESSAGE_LENGTH).toBe(2_000);
      expect(AI_RATE_LIMIT).toBe(10);
      expect(MAX_CHAT_HISTORY).toBe(20);
    });
  });

  describe('enum schemas', () => {
    it('validates dialects', () => {
      expect(dialectSchema.safeParse('mysql').success).toBe(true);
      expect(dialectSchema.safeParse('postgresql').success).toBe(true);
      expect(dialectSchema.safeParse('sqlite').success).toBe(true);
      expect(dialectSchema.safeParse('oracle').success).toBe(false);
    });

    it('validates migration formats', () => {
      expect(migrationFormatSchema.safeParse('raw').success).toBe(true);
      expect(migrationFormatSchema.safeParse('flyway').success).toBe(true);
      expect(migrationFormatSchema.safeParse('liquibase').success).toBe(true);
      expect(migrationFormatSchema.safeParse('prisma').success).toBe(true);
      expect(migrationFormatSchema.safeParse('alembic').success).toBe(false);
    });

    it('validates severities', () => {
      expect(severitySchema.safeParse('critical').success).toBe(true);
      expect(severitySchema.safeParse('warning').success).toBe(true);
      expect(severitySchema.safeParse('info').success).toBe(true);
      expect(severitySchema.safeParse('success').success).toBe(true);
      expect(severitySchema.safeParse('error').success).toBe(false);
    });
  });

  describe('parseRequestSchema', () => {
    it('accepts valid input', () => {
      const result = parseRequestSchema.safeParse({
        sql: 'CREATE TABLE users (id INT);',
        dialect: 'mysql',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty SQL', () => {
      const result = parseRequestSchema.safeParse({ sql: '', dialect: 'mysql' });
      expect(result.success).toBe(false);
    });

    it('rejects SQL exceeding max size', () => {
      const result = parseRequestSchema.safeParse({
        sql: 'x'.repeat(MAX_SQL_INPUT_SIZE + 1),
        dialect: 'mysql',
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional name', () => {
      const result = parseRequestSchema.safeParse({
        sql: 'CREATE TABLE users (id INT);',
        dialect: 'mysql',
        name: 'My Schema',
      });
      expect(result.success).toBe(true);
    });

    it('rejects name over 100 chars', () => {
      const result = parseRequestSchema.safeParse({
        sql: 'CREATE TABLE t (id INT);',
        dialect: 'mysql',
        name: 'x'.repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('queryRequestSchema', () => {
    it('accepts valid query', () => {
      const result = queryRequestSchema.safeParse({
        question: 'Show all users',
        schema: { tables: [] },
        dialect: 'postgresql',
      });
      expect(result.success).toBe(true);
    });

    it('rejects question exceeding max length', () => {
      const result = queryRequestSchema.safeParse({
        question: 'x'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1),
        schema: {},
        dialect: 'mysql',
      });
      expect(result.success).toBe(false);
    });

    it('limits history to MAX_CHAT_HISTORY entries', () => {
      const tooManyHistory = Array.from({ length: MAX_CHAT_HISTORY + 1 }, () => ({}));
      const result = queryRequestSchema.safeParse({
        question: 'test',
        schema: {},
        dialect: 'mysql',
        history: tooManyHistory,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('seedRequestSchema', () => {
    it('accepts valid seed config', () => {
      const result = seedRequestSchema.safeParse({
        schema: { tables: [] },
        config: {
          tables: [{ tableName: 'users', rowCount: 10 }],
          locale: 'hu',
          respectFK: true,
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects rowCount > 1000', () => {
      const result = seedRequestSchema.safeParse({
        schema: {},
        config: {
          tables: [{ tableName: 'users', rowCount: 1001 }],
          locale: 'en',
          respectFK: false,
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects rowCount < 1', () => {
      const result = seedRequestSchema.safeParse({
        schema: {},
        config: {
          tables: [{ tableName: 'users', rowCount: 0 }],
          locale: 'en',
          respectFK: false,
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createSchemaRequestSchema', () => {
    it('accepts valid input', () => {
      const result = createSchemaRequestSchema.safeParse({
        name: 'Test',
        dialect: 'sqlite',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = createSchemaRequestSchema.safeParse({
        name: '',
        dialect: 'mysql',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateSchemaRequestSchema', () => {
    it('accepts name update', () => {
      const result = updateSchemaRequestSchema.safeParse({ name: 'New Name' });
      expect(result.success).toBe(true);
    });

    it('accepts schema_json update', () => {
      const result = updateSchemaRequestSchema.safeParse({
        schema_json: { tables: [] },
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty object (no name or schema_json)', () => {
      const result = updateSchemaRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('updateSettingsSchema', () => {
    it('accepts partial settings', () => {
      const result = updateSettingsSchema.safeParse({ theme: 'dark' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid theme', () => {
      const result = updateSettingsSchema.safeParse({ theme: 'midnight' });
      expect(result.success).toBe(false);
    });

    it('rejects temperature > 1', () => {
      const result = updateSettingsSchema.safeParse({ temperature: 1.5 });
      expect(result.success).toBe(false);
    });

    it('rejects maxTokens < 256', () => {
      const result = updateSettingsSchema.safeParse({ maxTokens: 100 });
      expect(result.success).toBe(false);
    });
  });

  describe('saveChatSchema', () => {
    it('accepts valid messages', () => {
      const result = saveChatSchema.safeParse({
        messages: [
          {
            id: 'msg1',
            schemaId: 'sch1',
            role: 'user',
            content: 'Hello',
            timestamp: '2026-01-01T00:00:00Z',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty messages array', () => {
      const result = saveChatSchema.safeParse({ messages: [] });
      expect(result.success).toBe(false);
    });
  });

  describe('aiNormalizationResultSchema', () => {
    it('accepts valid AI normalization response', () => {
      const result = aiNormalizationResultSchema.safeParse({
        normalization: 20,
        issues: [
          {
            type: 'normalization',
            severity: 'warning',
            title: 'Denormalized field',
            affectedTable: 'orders',
          },
        ],
        summary: 'Schema has some normalization issues',
      });
      expect(result.success).toBe(true);
    });

    it('rejects normalization > 25', () => {
      const result = aiNormalizationResultSchema.safeParse({
        normalization: 30,
        issues: [],
        summary: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('limits issues to 10', () => {
      const issues = Array.from({ length: 11 }, (_, i) => ({
        type: 'normalization',
        severity: 'info',
        title: `Issue ${i}`,
        affectedTable: 'test',
      }));
      const result = aiNormalizationResultSchema.safeParse({
        normalization: 20,
        issues,
        summary: 'test',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('aiMigrationResultSchema', () => {
    it('accepts valid migration result', () => {
      const result = aiMigrationResultSchema.safeParse({
        name: 'add_email_index',
        description: 'Adds index on email column',
        upSQL: 'CREATE INDEX idx_email ON users(email);',
        downSQL: 'DROP INDEX idx_email;',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty upSQL', () => {
      const result = aiMigrationResultSchema.safeParse({
        name: 'test',
        description: 'test',
        upSQL: '',
        downSQL: 'DROP INDEX x;',
      });
      expect(result.success).toBe(false);
    });
  });
});
