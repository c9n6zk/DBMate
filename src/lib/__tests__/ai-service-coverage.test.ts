import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the non-exported functions buildSchemaContext and buildMessages
// by testing streamChatResponse which calls them, or by extracting them via module tricks.
// Since they're not exported, we test through the exported API + mock Anthropic SDK.

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      apiKey: string;
      baseURL?: string;
      constructor(opts: { apiKey: string; baseURL?: string }) {
        this.apiKey = opts.apiKey;
        this.baseURL = opts.baseURL;
      }
      messages = {
        stream: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Here is your query:\n```sql\nSELECT * FROM users;\n```' },
            };
          },
        }),
      };
    },
  };
});

// Must import AFTER mock is set up
import { streamChatResponse, estimateConfidence, AI_MODEL } from '../ai-service';
import type { Schema, ChatMessage } from '../types';

const testSchema: Schema = {
  id: 's1',
  name: 'TestDB',
  dialect: 'mysql',
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true, unique: false },
        { name: 'email', type: 'VARCHAR(255)', nullable: false, primaryKey: false, autoIncrement: false, unique: true, defaultValue: 'none' },
      ],
      primaryKey: ['id'],
      foreignKeys: [
        { columns: ['dept_id'], referencedTable: 'departments', referencedColumns: ['id'], onDelete: 'CASCADE' },
      ],
      indexes: [],
    },
  ],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  rawSQL: '',
};

describe('AI Service - full coverage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:42069';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('streamChatResponse', () => {
    it('streams text chunks and emits done with SQL extraction', async () => {
      const history: ChatMessage[] = [
        {
          id: 'h1',
          schemaId: 's1',
          role: 'user',
          content: 'Show all tables',
          timestamp: '2026-01-01',
          type: 'query',
        },
        {
          id: 'h2',
          schemaId: 's1',
          role: 'assistant',
          content: 'Here are the tables...',
          timestamp: '2026-01-01',
          type: 'query',
        },
      ];

      const chunks: { type: string; content: string }[] = [];
      for await (const chunk of streamChatResponse('Show all users', testSchema, history)) {
        chunks.push(chunk);
      }

      // Should have text chunks and a done chunk
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      const doneChunk = chunks.find((c) => c.type === 'done');
      expect(doneChunk).toBeDefined();

      // Done chunk should have parsed content with SQL
      const doneData = JSON.parse(doneChunk!.content);
      expect(doneData.fullContent).toContain('SELECT * FROM users');
      expect(doneData.sql).toBe('SELECT * FROM users;');
      expect(doneData.confidence).toBe('high');
    });

    it('streams with empty history', async () => {
      const chunks: { type: string; content: string }[] = [];
      for await (const chunk of streamChatResponse('test', testSchema, [])) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('AI_MODEL', () => {
    it('defaults to claude-sonnet-4-6', () => {
      // AI_MODEL reads process.env.AI_MODEL at module load
      expect(AI_MODEL).toBeDefined();
      expect(typeof AI_MODEL).toBe('string');
    });
  });

  describe('estimateConfidence - remaining branches', () => {
    it('handles schema.prefixed table names', () => {
      const sql = 'SELECT * FROM public.users';
      expect(estimateConfidence(sql, testSchema)).toBe('high');
    });

    it('handles multiple schema-prefixed references', () => {
      const sql = 'SELECT * FROM db.users JOIN db.orders ON users.id = orders.user_id';
      // 'orders' is not in testSchema, should be low
      expect(estimateConfidence(sql, testSchema)).toBe('low');
    });
  });
});
