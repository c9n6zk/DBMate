import { test, expect } from '@playwright/test';

test.describe('API: Schemas CRUD', () => {
  let schemaId: string;

  test('POST /api/schemas creates empty schema', async ({ request }) => {
    const res = await request.post('/api/schemas', {
      data: { name: 'Test CRUD', dialect: 'postgresql' },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.schema.name).toBe('Test CRUD');
    expect(data.schema.dialect).toBe('postgresql');
    expect(data.schema.tables).toEqual([]);
    schemaId = data.schema.id;
  });

  test('POST /api/schemas rejects invalid input', async ({ request }) => {
    const res = await request.post('/api/schemas', {
      data: { name: '', dialect: 'mysql' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/schemas rejects invalid dialect', async ({ request }) => {
    const res = await request.post('/api/schemas', {
      data: { name: 'Test', dialect: 'oracle' },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/schemas lists schemas', async ({ request }) => {
    // Create one first
    await request.post('/api/schemas', {
      data: { name: 'List Test', dialect: 'mysql' },
    });

    const res = await request.get('/api/schemas');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.schemas.length).toBeGreaterThan(0);
    expect(data.schemas[0]).toHaveProperty('id');
    expect(data.schemas[0]).toHaveProperty('name');
    expect(data.schemas[0]).toHaveProperty('dialect');
    expect(data.schemas[0]).toHaveProperty('updatedAt');
    expect(data.schemas[0]).toHaveProperty('tableCount');
  });

  test('GET /api/schemas/[id] loads full schema', async ({ request }) => {
    const createRes = await request.post('/api/schemas', {
      data: { name: 'Load Test', dialect: 'sqlite' },
    });
    const { schema } = await createRes.json();

    const res = await request.get(`/api/schemas/${schema.id}`);
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.schema.name).toBe('Load Test');
    expect(data.schema.dialect).toBe('sqlite');
    expect(data.healthReport).toBeNull();
  });

  test('GET /api/schemas/[id] returns 404 for nonexistent', async ({ request }) => {
    const res = await request.get('/api/schemas/nonexistent-id');
    expect(res.status()).toBe(404);
  });

  test('PATCH /api/schemas/[id] renames schema', async ({ request }) => {
    const createRes = await request.post('/api/schemas', {
      data: { name: 'Before Rename', dialect: 'mysql' },
    });
    const { schema } = await createRes.json();

    const res = await request.patch(`/api/schemas/${schema.id}`, {
      data: { name: 'After Rename' },
    });
    expect(res.ok()).toBe(true);

    const getRes = await request.get(`/api/schemas/${schema.id}`);
    const getData = await getRes.json();
    expect(getData.schema.name).toBe('After Rename');
  });

  test('PATCH /api/schemas/[id] updates schema content', async ({ request }) => {
    const createRes = await request.post('/api/schemas', {
      data: { name: 'Content Test', dialect: 'mysql' },
    });
    const { schema } = await createRes.json();

    const updatedSchema = {
      ...schema,
      tables: [{ name: 'users', columns: [], primaryKey: [], foreignKeys: [], indexes: [] }],
      rawSQL: 'CREATE TABLE users ();',
    };
    const res = await request.patch(`/api/schemas/${schema.id}`, {
      data: { schema_json: updatedSchema },
    });
    expect(res.ok()).toBe(true);

    const getRes = await request.get(`/api/schemas/${schema.id}`);
    const getData = await getRes.json();
    expect(getData.schema.tables).toHaveLength(1);
  });

  test('PATCH /api/schemas/[id] returns 404 for nonexistent', async ({ request }) => {
    const res = await request.patch('/api/schemas/nonexistent-id', {
      data: { name: 'X' },
    });
    expect(res.status()).toBe(404);
  });

  test('PATCH /api/schemas/[id] rejects empty body', async ({ request }) => {
    const createRes = await request.post('/api/schemas', {
      data: { name: 'Validate', dialect: 'mysql' },
    });
    const { schema } = await createRes.json();

    const res = await request.patch(`/api/schemas/${schema.id}`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('DELETE /api/schemas/[id] removes schema', async ({ request }) => {
    const createRes = await request.post('/api/schemas', {
      data: { name: 'To Delete', dialect: 'mysql' },
    });
    const { schema } = await createRes.json();

    const res = await request.delete(`/api/schemas/${schema.id}`);
    expect(res.ok()).toBe(true);

    const getRes = await request.get(`/api/schemas/${schema.id}`);
    expect(getRes.status()).toBe(404);
  });

  test('DELETE /api/schemas/[id] returns 404 for nonexistent', async ({ request }) => {
    const res = await request.delete('/api/schemas/nonexistent-id');
    expect(res.status()).toBe(404);
  });
});

test.describe('API: Schema Versions', () => {
  test('POST + GET version lifecycle', async ({ request }) => {
    // Create schema with content via parse
    const parseRes = await request.post('/api/parse', {
      data: {
        sql: 'CREATE TABLE ver_test (id INT PRIMARY KEY);',
        dialect: 'mysql',
        name: 'Version Test',
      },
    });
    const { schema } = await parseRes.json();

    // Create a version
    const vRes = await request.post(`/api/schemas/${schema.id}/versions`, {
      data: {
        schema_json: schema,
        change_description: 'Initial import',
      },
    });
    expect(vRes.status()).toBe(201);
    const vData = await vRes.json();
    expect(vData.version.versionNumber).toBe(1);

    // List versions
    const listRes = await request.get(`/api/schemas/${schema.id}/versions`);
    expect(listRes.ok()).toBe(true);
    const listData = await listRes.json();
    expect(listData.versions.length).toBeGreaterThanOrEqual(1);

    // Get specific version
    const getRes = await request.get(
      `/api/schemas/${schema.id}/versions/${vData.version.id}`
    );
    expect(getRes.ok()).toBe(true);
    const getData = await getRes.json();
    expect(getData.version.changeDescription).toBe('Initial import');
  });

  test('version numbers increment correctly', async ({ request }) => {
    const parseRes = await request.post('/api/parse', {
      data: { sql: 'CREATE TABLE inc_test (id INT PRIMARY KEY);', dialect: 'mysql' },
    });
    const { schema } = await parseRes.json();

    await request.post(`/api/schemas/${schema.id}/versions`, {
      data: { schema_json: schema, change_description: 'v1' },
    });
    const v2Res = await request.post(`/api/schemas/${schema.id}/versions`, {
      data: { schema_json: schema, change_description: 'v2' },
    });
    const v2 = await v2Res.json();
    expect(v2.version.versionNumber).toBe(2);
  });
});
