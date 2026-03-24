import { NextRequest, NextResponse } from 'next/server';
import { indexAnalysisRequestSchema, indexAnalysisResponseSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limiter';
import { extractJSON } from '@/lib/extract-json';
import { createAnthropicClient, AI_MODEL, systemPrompt } from '@/lib/ai-service';
import { withRetry, getTemperature } from '@/lib/ai-retry';
import { PROMPTS } from '@/lib/ai-prompts';
import { apiError } from '@/lib/api-helpers';
import type { Schema } from '@/lib/types';
import type Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';

function buildSchemaContext(schema: Schema): string {
  return schema.tables
    .map((t) => {
      const cols = t.columns
        .map((c) => `  ${c.name} ${c.type}${c.primaryKey ? ' PK' : ''}${c.unique ? ' UNIQUE' : ''}`)
        .join('\n');
      const idxs = t.indexes
        .map((i) => `  IDX: ${i.name} (${i.columns.join(', ')})${i.unique ? ' UNIQUE' : ''}`)
        .join('\n');
      const fks = t.foreignKeys
        .map((fk) => `  FK: ${fk.columns.join(',')} -> ${fk.referencedTable}(${fk.referencedColumns.join(',')})`)
        .join('\n');
      return `TABLE ${t.name}:\n${cols}${idxs ? '\n' + idxs : ''}${fks ? '\n' + fks : ''}`;
    })
    .join('\n\n');
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const parsed = indexAnalysisRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const schema = parsed.data.schema as unknown as Schema;
    const { queries } = parsed.data;
    const schemaContext = buildSchemaContext(schema);

    const client = createAnthropicClient();
    const userContent = `Schema (${schema.dialect}):\n${schemaContext}\n\nQueries to analyze:\n${queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nAnalyze index usage and provide recommendations:`;

    // Try withRetry for strict Zod validation first
    try {
      const validated = await withRetry({
        baseTemperature: 0.1,
        call: async (attempt, lastError) => {
          const temp = getTemperature(0.1, attempt);
          const retryHint = lastError
            ? `\n\n[RETRY: Your previous response had errors: ${lastError}. Fix the issues and respond with valid JSON only.]`
            : '';

          const response = await client.messages.create({
            model: AI_MODEL,
            max_tokens: 4096,
            temperature: temp,
            system: systemPrompt(PROMPTS.indexAnalysis.system, true),
            messages: [
              { role: 'user', content: userContent + retryHint },
            ],
          });

          const text = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('');

          return extractJSON(text);
        },
        schema: indexAnalysisResponseSchema,
      });

      return NextResponse.json(validated);
    } catch {
      // withRetry exhausted — lenient fallback with single call
    }

    // Lenient fallback
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      temperature: 0,
      system: systemPrompt(PROMPTS.indexAnalysis.system, true),
      messages: [
        { role: 'user', content: userContent },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const raw = extractJSON(text);

    return NextResponse.json({
      indexUsage: Array.isArray(raw.indexUsage) ? raw.indexUsage : [],
      suggestedIndexes: Array.isArray(raw.suggestedIndexes) ? raw.suggestedIndexes : [],
      unusedIndexes: Array.isArray(raw.unusedIndexes) ? raw.unusedIndexes : [],
    });
  } catch (err) {
    return apiError(err, 'Index analysis API error');
  }
}

/** GET: Fetch query history for a schema */
export async function GET(request: NextRequest) {
  const schemaId = request.nextUrl.searchParams.get('schemaId');
  if (!schemaId) {
    return NextResponse.json({ error: 'schemaId required' }, { status: 400 });
  }

  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT sql_output FROM query_history
         WHERE schema_id = ?
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .all(schemaId) as { sql_output: string }[];

    // Deduplicate
    const unique = [...new Set(rows.map((r) => r.sql_output))];
    return NextResponse.json({ queries: unique });
  } catch (err) {
    console.error('Query history fetch error:', err);
    return NextResponse.json({ queries: [] });
  }
}
