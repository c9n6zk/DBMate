import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { nanoid } from 'nanoid';
import { apiError } from '@/lib/api-helpers';

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/schemas/[id]/versions — list all versions for a schema */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT id, schema_id, version_number, change_description, created_at
         FROM schema_versions
         WHERE schema_id = ?
         ORDER BY version_number DESC`
      )
      .all(id) as {
      id: string;
      schema_id: string;
      version_number: number;
      change_description: string;
      created_at: string;
    }[];

    const versions = rows.map((r) => ({
      id: r.id,
      schemaId: r.schema_id,
      versionNumber: r.version_number,
      changeDescription: r.change_description,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ versions });
  } catch (err) {
    return apiError(err, 'GET /api/schemas/[id]/versions error');
  }
}

/** POST /api/schemas/[id]/versions — create a new version snapshot */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { schema_json, change_description } = body;

    if (!schema_json || !change_description) {
      return NextResponse.json(
        { error: 'schema_json and change_description are required' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check schema exists
    const exists = db
      .prepare(`SELECT id FROM schemas WHERE id = ?`)
      .get(id) as { id: string } | undefined;
    if (!exists) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
    }

    // Get next version number
    const row = db
      .prepare(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
         FROM schema_versions WHERE schema_id = ?`
      )
      .get(id) as { next_version: number };

    const versionId = nanoid();
    const nextVersion = row.next_version;

    // Insert new version
    db.prepare(
      `INSERT INTO schema_versions (id, schema_id, version_number, schema_json, change_description)
       VALUES (?, ?, ?, ?, ?)`
    ).run(versionId, id, nextVersion, JSON.stringify(schema_json), change_description);

    // Enforce max 50 versions per schema (FIFO)
    db.prepare(
      `DELETE FROM schema_versions
       WHERE id IN (
         SELECT id FROM schema_versions
         WHERE schema_id = ?
         ORDER BY version_number ASC
         LIMIT MAX(0, (SELECT COUNT(*) FROM schema_versions WHERE schema_id = ?) - 50)
       )`
    ).run(id, id);

    return NextResponse.json({
      version: {
        id: versionId,
        schemaId: id,
        versionNumber: nextVersion,
        changeDescription: change_description,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return apiError(err, 'POST /api/schemas/[id]/versions error');
  }
}
