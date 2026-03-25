import { test, expect } from '@playwright/test';

test.describe('API: Chat Messages', () => {
  let schemaId: string;

  test.beforeAll(async ({ request }) => {
    // Create schema for chat tests
    const res = await request.post('/api/schemas', {
      data: { name: 'Chat Test Schema', dialect: 'mysql' },
    });
    const data = await res.json();
    schemaId = data.schema.id;
  });

  test('POST /api/chat saves messages in batch', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: {
        messages: [
          {
            id: 'msg-1',
            schemaId,
            role: 'user',
            content: 'Show all users',
            timestamp: '2026-01-01T00:00:00Z',
          },
          {
            id: 'msg-2',
            schemaId,
            role: 'assistant',
            content: 'SELECT * FROM users;',
            sql: 'SELECT * FROM users;',
            confidence: 'high',
            type: 'query',
            timestamp: '2026-01-01T00:00:01Z',
          },
        ],
      },
    });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.count).toBe(2);
  });

  test('GET /api/chat loads messages for schema', async ({ request }) => {
    const res = await request.get(`/api/chat?schemaId=${schemaId}`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.messages.length).toBeGreaterThanOrEqual(2);
    expect(data.messages[0].schemaId).toBe(schemaId);
  });

  test('GET /api/chat respects limit parameter', async ({ request }) => {
    const res = await request.get(`/api/chat?schemaId=${schemaId}&limit=1`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.messages).toHaveLength(1);
  });

  test('GET /api/chat rejects missing schemaId', async ({ request }) => {
    const res = await request.get('/api/chat');
    expect(res.status()).toBe(400);
  });

  test('POST /api/chat rejects empty messages', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: { messages: [] },
    });
    expect(res.status()).toBe(400);
  });

  test('DELETE /api/chat clears messages for schema', async ({ request }) => {
    const res = await request.delete(`/api/chat?schemaId=${schemaId}`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.deleted).toBeGreaterThanOrEqual(0);

    // Verify cleared
    const getRes = await request.get(`/api/chat?schemaId=${schemaId}`);
    const getData = await getRes.json();
    expect(getData.messages).toHaveLength(0);
  });

  test('DELETE /api/chat rejects missing schemaId', async ({ request }) => {
    const res = await request.delete('/api/chat');
    expect(res.status()).toBe(400);
  });
});
