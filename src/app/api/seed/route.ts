import { NextRequest, NextResponse } from 'next/server';
import { seedRequestSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limiter';
import { createAnthropicClient, AI_MODEL, systemPrompt } from '@/lib/ai-service';
import { getTemperature } from '@/lib/ai-retry';
import { PROMPTS, FEW_SHOT } from '@/lib/ai-prompts';
import { topologicalSortTables, buildSeedSchemaContext } from '@/lib/seed-utils';
import { validateSeedSQL } from '@/lib/seed-validator';
import { apiError } from '@/lib/api-helpers';
import { escapeRegex } from '@/lib/utils';
import type { Schema, SeedResult } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = seedRequestSchema.safeParse(body);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json({ error: firstError.message }, { status: 400 });
    }

    const schema = result.data.schema as unknown as Schema;
    const { tables, locale, respectFK } = result.data.config;

    // Rate limit
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

    // FK dependency order
    const selectedTableNames = tables.map((t) => t.tableName);
    const insertOrder = respectFK
      ? topologicalSortTables(schema).filter((t) =>
          selectedTableNames.includes(t)
        )
      : selectedTableNames;

    // Build table config string
    const tableConfigs = tables
      .map((t) => {
        const rules = t.customRules
          ?.map((r) => `    ${r.columnName}: ${r.rule}(${r.value})`)
          .join('\n');
        return `- ${t.tableName}: ${t.rowCount} rows${rules ? '\n' + rules : ''}`;
      })
      .join('\n');

    const schemaContext = buildSeedSchemaContext(schema, selectedTableNames);

    // AI generation with seed-specific retry (max 1 retry — seed is expensive)
    const client = createAnthropicClient();
    const userContent = `Generate realistic seed data for the following database schema.

Schema:
${schemaContext}

Configuration:
- Tables to seed (in dependency order): ${insertOrder.join(' → ')}
${tableConfigs}
- Locale: ${locale} (use locale-appropriate names, addresses, phone numbers, etc.)
- Dialect: ${schema.dialect}
${respectFK ? '- MUST respect all foreign key constraints (referenced IDs must exist)' : ''}
- Ensure UNIQUE constraints are not violated
- Use realistic, diverse data (not "test1", "test2")
- Status/enum columns: use realistic distribution (e.g., 70% active, 20% inactive, 10% blocked)
- Dates: distribute across a realistic range
- Prices/amounts: realistic ranges for the domain

Requirements:
- Generate valid INSERT INTO statements
- Insert in this exact order: ${insertOrder.join(', ')}
- Include proper escaping for strings
- Auto-increment PKs: start from 1
- Each table's INSERTs should be a single INSERT with multiple VALUES rows

Return the complete INSERT statements as SQL.`;

    let text = '';
    let validation = validateSeedSQL('', schema);
    const MAX_SEED_RETRIES = 1;

    for (let attempt = 0; attempt <= MAX_SEED_RETRIES; attempt++) {
      const retryHint =
        attempt > 0 && validation.errors.length > 0
          ? `\n\n[RETRY: Previous output had errors: ${validation.errors.join('; ')}. Fix these issues.]`
          : '';

      const response = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 8192,
        temperature: getTemperature(0.3, attempt),
        system: systemPrompt(PROMPTS.seed.system, true),
        messages: [
          ...FEW_SHOT.seed,
          { role: 'user', content: userContent + retryHint },
        ],
      });

      text = response.content[0].type === 'text' ? response.content[0].text : '';
      validation = validateSeedSQL(text, schema);

      if (validation.valid) break;
    }

    // Parse out individual table INSERT blocks
    const seeds: SeedResult[] = [];
    let totalRows = 0;

    for (const tableName of insertOrder) {
      // Extract INSERT INTO <tableName> ... block
      const pattern = new RegExp(
        `INSERT INTO \\b${escapeRegex(tableName)}\\b[\\s\\S]*?;`,
        'gi'
      );
      const matches = text.match(pattern);
      const insertStatements = matches ? matches.join('\n\n') : '';

      // Count rows (VALUES tuples)
      const rowCount = (insertStatements.match(/\(/g) || []).length;
      // Subtract the column list parentheses (one per INSERT statement)
      const insertCount = (matches || []).length;
      const actualRows = Math.max(0, rowCount - insertCount);

      seeds.push({
        tableName,
        insertStatements,
        rowCount: actualRows,
      });
      totalRows += actualRows;
    }

    return NextResponse.json({ seeds, totalRows, insertOrder });
  } catch (err) {
    return apiError(err, 'Seed API error');
  }
}
