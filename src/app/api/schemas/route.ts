import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db';
import { createSchemaRequestSchema } from '@/lib/validations';
import { apiError } from '@/lib/api-helpers';
import type { Schema } from '@/lib/types';

/** GET /api/schemas — list all schemas (lightweight) */
export async function GET() {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, name, dialect, updated_at, table_count
         FROM schemas ORDER BY updated_at DESC`
      )
      .all() as {
      id: string;
      name: string;
      dialect: string;
      updated_at: string;
      table_count: number;
    }[];

    const schemas = rows.map((r) => ({
      id: r.id,
      name: r.name,
      dialect: r.dialect,
      updatedAt: r.updated_at,
      tableCount: r.table_count,
    }));

    return NextResponse.json({ schemas });
  } catch (err) {
    return apiError(err, 'GET /api/schemas error');
  }
}

/** POST /api/schemas — create a new empty schema */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = createSchemaRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, dialect } = result.data;
    const now = new Date().toISOString();
    const id = nanoid();

    const schema: Schema = {
      id,
      name,
      dialect,
      tables: [],
      rawSQL: '',
      createdAt: now,
      updatedAt: now,
    };

    const db = getDb();
    db.prepare(
      `INSERT INTO schemas (id, name, dialect, raw_sql, schema_json, table_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(id, name, dialect, '', JSON.stringify(schema), now, now);

    return NextResponse.json({ schema }, { status: 201 });
  } catch (err) {
    return apiError(err, 'POST /api/schemas error');
  }
}
