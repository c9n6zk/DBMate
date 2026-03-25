import { test, expect } from '@playwright/test';

test.describe('API Health Check', () => {
  test('GET /api/health returns status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('configured');
    expect(typeof data.configured).toBe('boolean');
  });

  test('GET /api/schemas returns empty array initially', async ({ request }) => {
    const response = await request.get('/api/schemas');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('POST /api/parse validates input', async ({ request }) => {
    // Missing required fields
    const response = await request.post('/api/parse', {
      data: {},
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('POST /api/parse creates schema from valid SQL', async ({ request }) => {
    const response = await request.post('/api/parse', {
      data: {
        sql: 'CREATE TABLE test_api (id INT PRIMARY KEY, name VARCHAR(50));',
        dialect: 'mysql',
        name: 'API Test Schema',
      },
    });
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('schema');
    expect(data.schema.tables).toHaveLength(1);
    expect(data.schema.tables[0].name).toBe('test_api');
  });

  test('GET /api/settings returns settings object', async ({ request }) => {
    const response = await request.get('/api/settings');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('theme');
    expect(data).toHaveProperty('language');
    expect(data).toHaveProperty('dialect');
  });
});
