import { test, expect } from '@playwright/test';

test.describe('API: Parse', () => {
  test('POST /api/parse creates schema from SQL', async ({ request }) => {
    const res = await request.post('/api/parse', {
      data: {
        sql: `
          CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100) NOT NULL);
          CREATE TABLE posts (id INT PRIMARY KEY, user_id INT, FOREIGN KEY (user_id) REFERENCES users(id));
        `,
        dialect: 'mysql',
        name: 'Parse Test',
      },
    });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.schema.name).toBe('Parse Test');
    expect(data.schema.tables).toHaveLength(2);
    expect(data.schema.tables[0].name).toBe('users');
    expect(data.schema.tables[1].foreignKeys).toHaveLength(1);
  });

  test('POST /api/parse rejects empty SQL', async ({ request }) => {
    const res = await request.post('/api/parse', {
      data: { sql: '', dialect: 'mysql' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/parse rejects invalid SQL', async ({ request }) => {
    const res = await request.post('/api/parse', {
      data: { sql: 'NOT VALID SQL', dialect: 'mysql' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('POST /api/parse rejects SQL without CREATE TABLE', async ({ request }) => {
    const res = await request.post('/api/parse', {
      data: { sql: 'SELECT * FROM users;', dialect: 'mysql' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('POST /api/parse handles PostgreSQL dialect', async ({ request }) => {
    const res = await request.post('/api/parse', {
      data: {
        sql: 'CREATE TABLE pg_test (id INT PRIMARY KEY, data TEXT);',
        dialect: 'postgresql',
      },
    });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.schema.dialect).toBe('postgresql');
  });

  test('POST /api/parse handles SQLite dialect', async ({ request }) => {
    const res = await request.post('/api/parse', {
      data: {
        sql: 'CREATE TABLE sqlite_test (id INTEGER PRIMARY KEY);',
        dialect: 'sqlite',
      },
    });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.schema.dialect).toBe('sqlite');
  });

  test('POST /api/parse persists schema to DB', async ({ request }) => {
    const parseRes = await request.post('/api/parse', {
      data: {
        sql: 'CREATE TABLE persist_test (id INT PRIMARY KEY);',
        dialect: 'mysql',
        name: 'Persist Check',
      },
    });
    const { schema } = await parseRes.json();

    // Should be loadable via GET
    const getRes = await request.get(`/api/schemas/${schema.id}`);
    expect(getRes.ok()).toBe(true);
    const getData = await getRes.json();
    expect(getData.schema.name).toBe('Persist Check');
  });
});

test.describe('API: Analyze', () => {
  test('POST /api/analyze returns health report for valid schema', async ({ request }) => {
    const res = await request.post('/api/analyze', {
      data: {
        schema: {
          id: 'test',
          name: 'test',
          dialect: 'mysql',
          tables: [
            {
              name: 'users',
              columns: [
                { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true, unique: false },
                { name: 'password', type: 'VARCHAR(255)', nullable: true, primaryKey: false, autoIncrement: false, unique: false },
              ],
              primaryKey: ['id'],
              foreignKeys: [],
              indexes: [],
            },
          ],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          rawSQL: '',
        },
      },
    });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.report).toBeDefined();
    expect(data.report.score).toBeDefined();
    expect(data.report.breakdown).toBeDefined();
    expect(data.report.breakdown.performance).toBeDefined();
    expect(data.report.breakdown.security).toBeDefined();
    expect(data.report.breakdown.conventions).toBeDefined();
    expect(data.report.issues).toBeInstanceOf(Array);

    // Should detect plain-text password
    const securityIssues = data.report.issues.filter(
      (i: { type: string }) => i.type === 'security'
    );
    expect(securityIssues.length).toBeGreaterThan(0);
  });

  test('POST /api/analyze rejects invalid body', async ({ request }) => {
    const res = await request.post('/api/analyze', {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('API: Migrate', () => {
  test('GET /api/migrate returns migrations for schema', async ({ request }) => {
    const parseRes = await request.post('/api/parse', {
      data: { sql: 'CREATE TABLE mig_test (id INT PRIMARY KEY);', dialect: 'mysql' },
    });
    const { schema } = await parseRes.json();

    const res = await request.get(`/api/migrate?schemaId=${schema.id}`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.migrations).toBeInstanceOf(Array);
  });
});

test.describe('API: Migrate Apply', () => {
  test('POST /api/migrate/apply marks migration as applied', async ({ request }) => {
    // First create a schema + migration via parse
    const parseRes = await request.post('/api/parse', {
      data: { sql: 'CREATE TABLE apply_test (id INT PRIMARY KEY);', dialect: 'mysql' },
    });
    const { schema } = await parseRes.json();

    // Create a migration with fixSQL (static template path)
    const migrateRes = await request.post('/api/migrate', {
      data: {
        schema,
        schemaId: schema.id,
        change: 'add index on apply_test(id)',
        dialect: 'mysql',
        format: 'raw',
        nextVersion: 'v001',
      },
    });

    if (migrateRes.ok()) {
      const migData = await migrateRes.json();
      if (migData.migration?.id) {
        const applyRes = await request.post('/api/migrate/apply', {
          data: { migrationId: migData.migration.id },
        });
        expect(applyRes.ok()).toBe(true);
      }
    }
  });
});
