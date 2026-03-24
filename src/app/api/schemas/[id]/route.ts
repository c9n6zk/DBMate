import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { updateSchemaRequestSchema } from '@/lib/validations';
import { apiError } from '@/lib/api-helpers';
import type { Schema } from '@/lib/types';

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/schemas/[id] — load a single schema (full schema_json + health_report) */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db
      .prepare(`SELECT schema_json, health_report FROM schemas WHERE id = ?`)
      .get(id) as { schema_json: string; health_report: string | null } | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    }

    const schema: Schema = JSON.parse(row.schema_json);
    const healthReport = row.health_report ? JSON.parse(row.health_report) : null;
    return NextResponse.json({ schema, healthReport });
  } catch (err) {
    return apiError(err, 'GET /api/schemas/[id] error');
  }
}

/** PATCH /api/schemas/[id] — rename and/or update schema content */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = updateSchemaRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, schema_json, health_report } = result.data;
    const db = getDb();
    const now = new Date().toISOString();

    // Check schema exists
    const exists = db
      .prepare(`SELECT id FROM schemas WHERE id = ?`)
      .get(id) as { id: string } | undefined;
    if (!exists) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    }

    if (schema_json) {
      // Full schema update (content + optionally name + optionally health_report)
      const schemaObj = schema_json as unknown as Schema;
      const updatedName = name ?? schemaObj.name;
      const tableCount = Array.isArray(schemaObj.tables)
        ? schemaObj.tables.length
        : 0;

      db.prepare(
        `UPDATE schemas
         SET schema_json = ?, raw_sql = ?, name = ?, table_count = ?, health_report = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        JSON.stringify(schema_json),
        schemaObj.rawSQL ?? '',
        updatedName,
        tableCount,
        health_report !== undefined ? JSON.stringify(health_report) : null,
        now,
        id
      );
    } else if (name) {
      // Name-only rename
      db.prepare(`UPDATE schemas SET name = ?, updated_at = ? WHERE id = ?`).run(
        name,
        now,
        id
      );
    }

    return NextResponse.json({ success: true, updatedAt: now });
  } catch (err) {
    return apiError(err, 'PATCH /api/schemas/[id] error');
  }
}

/** DELETE /api/schemas/[id] — delete schema and all related data (CASCADE) */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const result = db.prepare(`DELETE FROM schemas WHERE id = ?`).run(id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err, 'DELETE /api/schemas/[id] error');
  }
}
