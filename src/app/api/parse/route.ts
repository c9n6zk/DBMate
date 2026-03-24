import { NextRequest, NextResponse } from 'next/server';
import { parseSQL } from '@/lib/sql-parser';
import { parseRequestSchema } from '@/lib/validations';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api-helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = parseRequestSchema.safeParse(body);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      );
    }

    const { sql, dialect, name } = result.data;

    // Parse SQL
    const { schema, warnings } = parseSQL(sql, dialect, name);

    // Persist to SQLite
    const db = getDb();
    db.prepare(
      `INSERT INTO schemas (id, name, dialect, raw_sql, schema_json, table_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      schema.id,
      schema.name,
      schema.dialect,
      schema.rawSQL,
      JSON.stringify(schema),
      schema.tables.length,
      schema.createdAt,
      schema.updatedAt
    );

    // Save initial version
    db.prepare(
      `INSERT INTO schema_versions (id, schema_id, version_number, schema_json, change_description)
       VALUES (?, ?, 1, ?, 'Initial import')`
    ).run(
      `${schema.id}_v1`,
      schema.id,
      JSON.stringify(schema)
    );

    return NextResponse.json({ schema, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.startsWith('SQL parse error:')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return apiError(err, 'Parse API error');
  }
}
