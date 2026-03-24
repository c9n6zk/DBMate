import { NextRequest, NextResponse } from 'next/server';
import { migrateRequestSchema, aiMigrationResultSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limiter';
import { createAnthropicClient, AI_MODEL, systemPrompt } from '@/lib/ai-service';
import { extractJSON } from '@/lib/extract-json';
import { withRetry, getTemperature } from '@/lib/ai-retry';
import { PROMPTS, FEW_SHOT } from '@/lib/ai-prompts';
import {
  generateStaticMigration,
  parseMigrationIntent,
} from '@/lib/migration-templates';
import { formatMigration } from '@/lib/migration-formatter';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api-helpers';
import type { Schema, Migration, MigrationFormat } from '@/lib/types';

async function generateMigrationWithAI(
  schema: Schema,
  change: string,
  dialect: string,
  version: string,
  schemaId: string
): Promise<Migration> {
  const client = createAnthropicClient();

  const schemaJSON = JSON.stringify(
    schema.tables.map((t) => ({
      name: t.name,
      columns: t.columns.map((c) => ({
        name: c.name,
        type: c.type,
        primaryKey: c.primaryKey,
        nullable: c.nullable,
      })),
      foreignKeys: t.foreignKeys.map((fk) => ({
        columns: fk.columns,
        referencedTable: fk.referencedTable,
        referencedColumns: fk.referencedColumns,
      })),
      primaryKey: t.primaryKey,
    })),
    null,
    2
  );

  const userContent = `Generate a database migration for a complex schema change.

Current schema: ${schemaJSON}
Requested change: "${change}"
Dialect: ${dialect}

Requirements:
- Generate both UP (apply) and DOWN (rollback) scripts
- DOWN must perfectly reverse the UP
- Handle data preservation where needed
- Use correct ${dialect} syntax

Return JSON:
{ "name": "...", "description": "...", "upSQL": "...", "downSQL": "..." }`;

  const validated = await withRetry({
    baseTemperature: 0.1,
    call: async (attempt, lastError) => {
      const temp = getTemperature(0.1, attempt);
      const retryHint = lastError
        ? `\n\n[RETRY: Your previous response had errors: ${lastError}. Fix the issues and respond with valid JSON only.]`
        : '';

      const response = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 2048,
        temperature: temp,
        system: systemPrompt(PROMPTS.migration.system, true),
        messages: [
          ...FEW_SHOT.migration,
          { role: 'user', content: userContent + retryHint },
        ],
      });

      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';
      const json = extractJSON(text);
      // Normalize common AI key variants (up_sql → upSQL, etc.)
      if ('up_sql' in json && !('upSQL' in json)) json.upSQL = json.up_sql;
      if ('down_sql' in json && !('downSQL' in json)) json.downSQL = json.down_sql;
      if ('up' in json && !('upSQL' in json)) json.upSQL = json.up;
      if ('down' in json && !('downSQL' in json)) json.downSQL = json.down;
      return json;
    },
    schema: aiMigrationResultSchema,
  });

  const { nanoid } = await import('nanoid');

  return {
    id: nanoid(),
    schemaId,
    version,
    name: validated.name,
    upSQL: validated.upSQL,
    downSQL: validated.downSQL,
    description: validated.description,
    format: 'raw',
    appliedAt: undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = migrateRequestSchema.safeParse(body);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json({ error: firstError.message }, { status: 400 });
    }

    const { schemaId, change, dialect, format, nextVersion, fixSQL } =
      result.data;
    const schema = result.data.schema as unknown as Schema;

    let migration: Migration;

    // Decision logic: fixSQL → static, pattern match → static, else → AI
    if (fixSQL) {
      migration = generateStaticMigration(
        { type: 'APPLY_FIX', fixSQL },
        dialect,
        nextVersion,
        schemaId
      );
    } else {
      const parsed = parseMigrationIntent(change);
      if (parsed) {
        migration = generateStaticMigration(
          parsed,
          dialect,
          nextVersion,
          schemaId
        );
      } else {
        // AI fallback — rate limit check
        const ip =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          'anonymous';
        const rateCheck = checkRateLimit(ip);
        if (!rateCheck.allowed) {
          return NextResponse.json(
            { error: 'Rate limit exceeded. Please wait a moment.' },
            { status: 429 }
          );
        }

        migration = await generateMigrationWithAI(
          schema,
          change,
          dialect,
          nextVersion,
          schemaId
        );
      }
    }

    // Apply requested format
    migration.format = format as MigrationFormat;

    // Store in SQLite
    const db = getDb();
    db.prepare(
      `INSERT INTO migrations (id, schema_id, version, name, up_sql, down_sql, description, format, applied_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      migration.id,
      migration.schemaId,
      migration.version,
      migration.name,
      migration.upSQL,
      migration.downSQL,
      migration.description,
      migration.format,
      migration.appliedAt ?? null
    );

    // Return formatted migration
    const formatted = formatMigration(migration, format as MigrationFormat);

    return NextResponse.json({ migration, formatted });
  } catch (err) {
    return apiError(err, 'Migrate API error');
  }
}

// GET — load migrations for a schema
export async function GET(request: NextRequest) {
  try {
    const schemaId = request.nextUrl.searchParams.get('schemaId');
    if (!schemaId) {
      return NextResponse.json(
        { error: 'schemaId is required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, schema_id, version, name, up_sql, down_sql, description, format, applied_at, created_at
         FROM migrations
         WHERE schema_id = ?
         ORDER BY created_at ASC`
      )
      .all(schemaId) as Array<{
      id: string;
      schema_id: string;
      version: string;
      name: string;
      up_sql: string;
      down_sql: string;
      description: string;
      format: string;
      applied_at: string | null;
      created_at: string;
    }>;

    const migrations: Migration[] = rows.map((r) => ({
      id: r.id,
      schemaId: r.schema_id,
      version: r.version,
      name: r.name,
      upSQL: r.up_sql,
      downSQL: r.down_sql,
      description: r.description,
      format: r.format as Migration['format'],
      appliedAt: r.applied_at ?? undefined,
    }));

    return NextResponse.json({ migrations });
  } catch (err) {
    return apiError(err, 'Migrate GET error');
  }
}
