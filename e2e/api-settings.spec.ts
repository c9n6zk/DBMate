import { test, expect } from '@playwright/test';

test.describe('API: Settings', () => {
  test('GET /api/settings returns settings object', async ({ request }) => {
    const res = await request.get('/api/settings');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty('settings');
  });

  test('PUT /api/settings updates theme', async ({ request }) => {
    const res = await request.put('/api/settings', {
      data: { theme: 'dark' },
    });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.settings.theme).toBe('dark');

    // Reset
    await request.put('/api/settings', { data: { theme: 'system' } });
  });

  test('PUT /api/settings updates multiple fields', async ({ request }) => {
    const res = await request.put('/api/settings', {
      data: { language: 'en', dialect: 'postgresql', temperature: 0.5 },
    });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.settings.language).toBe('en');
    expect(data.settings.dialect).toBe('postgresql');
    expect(data.settings.temperature).toBe(0.5);

    // Reset
    await request.put('/api/settings', {
      data: { language: 'hu', dialect: 'mysql', temperature: 0.1 },
    });
  });

  test('PUT /api/settings rejects invalid theme', async ({ request }) => {
    const res = await request.put('/api/settings', {
      data: { theme: 'midnight' },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/settings rejects temperature > 1', async ({ request }) => {
    const res = await request.put('/api/settings', {
      data: { temperature: 1.5 },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/settings rejects maxTokens < 256', async ({ request }) => {
    const res = await request.put('/api/settings', {
      data: { maxTokens: 100 },
    });
    expect(res.status()).toBe(400);
  });

  test('settings persist across requests', async ({ request }) => {
    await request.put('/api/settings', { data: { seedDefaultRows: 99 } });

    const res = await request.get('/api/settings');
    const data = await res.json();
    expect(data.settings.seedDefaultRows).toBe(99);

    // Reset
    await request.put('/api/settings', { data: { seedDefaultRows: 50 } });
  });
});
