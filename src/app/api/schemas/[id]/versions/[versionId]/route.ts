import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api-helpers';
import type { Schema } from '@/lib/types';

type RouteParams = { params: Promise<{ id: string; versionId: string }> };

/** GET /api/schemas/[id]/versions/[versionId] — load a specific version's schema_json */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id, versionId } = await params;
    const db = getDb();

    const row = db
      .prepare(
        `SELECT id, schema_id, version_number, schema_json, change_description, created_at
         FROM schema_versions
         WHERE id = ? AND schema_id = ?`
      )
      .get(versionId, id) as {
      id: string;
      schema_id: string;
      version_number: number;
      schema_json: string;
      change_description: string;
      created_at: string;
    } | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    const schema: Schema = JSON.parse(row.schema_json);

    return NextResponse.json({
      version: {
        id: row.id,
        schemaId: row.schema_id,
        versionNumber: row.version_number,
        changeDescription: row.change_description,
        createdAt: row.created_at,
      },
      schema,
    });
  } catch (err) {
    return apiError(err, 'GET /api/schemas/[id]/versions/[versionId] error');
  }
}
