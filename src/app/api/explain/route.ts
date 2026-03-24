import { NextRequest, NextResponse } from 'next/server';
import { explainRequestSchema, explainResponseSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limiter';
import { extractJSON } from '@/lib/extract-json';
import { createAnthropicClient, AI_MODEL, systemPrompt } from '@/lib/ai-service';
import { withRetry, getTemperature } from '@/lib/ai-retry';
import { PROMPTS, FEW_SHOT } from '@/lib/ai-prompts';
import { apiError } from '@/lib/api-helpers';
import type { Schema } from '@/lib/types';
import type Anthropic from '@anthropic-ai/sdk';

interface HypotheticalIndex {
  table: string;
  columns: string[];
  unique?: boolean;
}

interface RemovedIndex {
  table: string;
  indexName: string;
}

function buildSchemaContext(
  schema: Schema,
  hypotheticalIndexes?: HypotheticalIndex[],
  removedIndexes?: RemovedIndex[]
): string {
  const lines = schema.tables.map((t) => {
    const cols = t.columns
      .map((c) => `  ${c.name} ${c.type}${c.primaryKey ? ' PK' : ''}${c.unique ? ' UNIQUE' : ''}`)
      .join('\n');

    // Filter out removed indexes
    const removedNames = new Set(
      (removedIndexes ?? [])
        .filter((r) => r.table === t.name)
        .map((r) => r.indexName)
    );
    const activeIdxs = t.indexes.filter((i) => !removedNames.has(i.name));
    const idxLines = activeIdxs
      .map((i) => `  IDX: ${i.name} (${i.columns.join(', ')})${i.unique ? ' UNIQUE' : ''}`)
      .join('\n');

    // Add hypothetical indexes for this table
    const hypoForTable = (hypotheticalIndexes ?? []).filter((h) => h.table === t.name);
    const hypoLines = hypoForTable
      .map((h) => `  HYPOTHETICAL IDX: hypo_${h.columns.join('_')} (${h.columns.join(', ')})${h.unique ? ' UNIQUE' : ''}`)
      .join('\n');

    const fks = t.foreignKeys
      .map((fk) => `  FK: ${fk.columns.join(',')} -> ${fk.referencedTable}(${fk.referencedColumns.join(',')})`)
      .join('\n');

    return `TABLE ${t.name}:\n${cols}${idxLines ? '\n' + idxLines : ''}${hypoLines ? '\n' + hypoLines : ''}${fks ? '\n' + fks : ''}`;
  });

  return lines.join('\n\n');
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
    const parsed = explainRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { sql, schema: rawSchema, dialect, hypotheticalIndexes, removedIndexes } = parsed.data;
    const schema = rawSchema as unknown as Schema;
    const schemaContext = buildSchemaContext(schema, hypotheticalIndexes, removedIndexes);

    let whatIfNote = '';
    if (hypotheticalIndexes?.length) {
      whatIfNote += `\n\nHYPOTHETICAL INDEXES (treat as existing):\n${hypotheticalIndexes.map((h) => `- ${h.table}(${h.columns.join(', ')})${h.unique ? ' UNIQUE' : ''}`).join('\n')}`;
    }
    if (removedIndexes?.length) {
      whatIfNote += `\n\nREMOVED INDEXES (treat as non-existing):\n${removedIndexes.map((r) => `- ${r.table}.${r.indexName}`).join('\n')}`;
    }

    const client = createAnthropicClient();
    const userContent = `Schema (${dialect}):\n${schemaContext}${whatIfNote}\n\nSQL Query:\n${sql}\n\nGenerate the execution plan JSON with warnings and recommendations:`;

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
            max_tokens: 3072,
            temperature: temp,
            system: systemPrompt(PROMPTS.explain.system, true),
            messages: [
              ...FEW_SHOT.explain,
              { role: 'user', content: userContent + retryHint },
            ],
          });

          const text = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('');

          return extractJSON(text);
        },
        schema: explainResponseSchema,
      });

      return NextResponse.json(validated);
    } catch {
      // withRetry exhausted — try one last lenient parse from the last attempt
      // This preserves backward compatibility with partial AI responses
    }

    // Lenient fallback: single call without strict validation
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 3072,
      temperature: 0,
      system: systemPrompt(PROMPTS.explain.system, true),
      messages: [
        { role: 'user', content: userContent },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const raw = extractJSON(text);

    // Fallback: try to extract plan from legacy format (just a plan node at root)
    if (raw.id && raw.type && raw.children) {
      return NextResponse.json({
        plan: raw,
        totalCost: (raw as Record<string, unknown>).cost ?? 0,
        warnings: [],
        recommendations: [],
      });
    }

    // Last resort: if plan key exists but validation failed, return with defaults
    if (raw.plan) {
      return NextResponse.json({
        plan: raw.plan,
        totalCost: raw.totalCost ?? 0,
        warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
        recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
      });
    }

    return NextResponse.json({ error: 'Invalid AI response structure' }, { status: 500 });
  } catch (err) {
    return apiError(err, 'Explain API error');
  }
}
