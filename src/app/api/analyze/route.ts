import { NextRequest, NextResponse } from 'next/server';
import { analyzeRequestSchema, aiNormalizationResultSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limiter';
import { extractJSON } from '@/lib/extract-json';
import { runStaticAnalysis } from '@/lib/static-analyzer';
import { createAnthropicClient, AI_MODEL, systemPrompt } from '@/lib/ai-service';
import { withRetry, getTemperature } from '@/lib/ai-retry';
import { PROMPTS, FEW_SHOT } from '@/lib/ai-prompts';
import { apiError } from '@/lib/api-helpers';
import type { Schema, AnalysisIssue, SchemaHealthReport } from '@/lib/types';
import type { z } from 'zod/v4';

type NormalizationResult = z.infer<typeof aiNormalizationResultSchema>;

async function analyzeNormalizationWithAI(
  schema: Schema,
  appliedFixes: string[] = []
): Promise<{ normalization: number; issues: AnalysisIssue[]; summary: string }> {
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

  const appliedHint = appliedFixes.length > 0
    ? `\n\nIMPORTANT: The user has ALREADY accepted and applied the following fixes. Do NOT report these again:\n${appliedFixes.map(f => `- ${f}`).join('\n')}\n`
    : '';

  const userContent = `Analyze ONLY the normalization quality of this schema.
Do NOT check performance, security, or naming conventions — those are handled by the local static analyzer.

${schemaJSON}
${appliedHint}
Check for:
1. 1NF violations (repeating groups, multi-valued columns, non-atomic values)
2. 2NF violations (partial dependencies in composite primary keys)
3. 3NF violations (transitive dependencies — e.g., city_name stored directly instead of via FK)
4. BCNF violations (non-trivial functional dependencies where determinant is not a superkey)

Return ONLY this JSON (no markdown, no code blocks):
{
  "normalization": <0-25>,
  "issues": [{ "type": "normalization", "severity": "warning"|"info"|"critical", "title": "short title",
               "description": "one sentence", "affectedTable": "table_name", "suggestion": "one sentence", "fixSQL": "ALTER..." }],
  "summary": "Brief normalization assessment (one sentence)"
}`;

  const validated: NormalizationResult = await withRetry({
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
        system: systemPrompt(PROMPTS.normalization.system, true),
        messages: [
          ...FEW_SHOT.normalization,
          { role: 'user', content: userContent + retryHint },
        ],
      });

      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';
      return extractJSON(text);
    },
    schema: aiNormalizationResultSchema,
  });

  return {
    normalization: validated.normalization,
    issues: validated.issues.map((issue) => ({
      ...issue,
      id: `norm_${Math.random().toString(36).slice(2, 10)}`,
      type: 'normalization' as const,
    })),
    summary: validated.summary,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = analyzeRequestSchema.safeParse(body);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return NextResponse.json({ error: firstError.message }, { status: 400 });
    }

    const schema = result.data.schema as unknown as Schema;
    const appliedFixes = result.data.appliedFixes ?? [];

    // Static analysis (instant)
    const staticResult = runStaticAnalysis(schema);

    // AI normalization (with graceful fallback)
    let normResult: {
      normalization: number;
      issues: AnalysisIssue[];
      summary: string;
    };

    try {
      // Rate limit check for AI call
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        'anonymous';
      const rateCheck = checkRateLimit(ip);
      if (!rateCheck.allowed) {
        throw new Error('Rate limit exceeded');
      }

      normResult = await analyzeNormalizationWithAI(schema, appliedFixes);
    } catch (err) {
      normResult = {
        normalization: 0,
        issues: [],
        summary: `Normalization analysis unavailable (${err instanceof Error ? err.message : 'unknown error'}). Performance, security, and conventions scores are still accurate.`,
      };
    }

    const report: SchemaHealthReport = {
      score:
        staticResult.breakdown.performance +
        staticResult.breakdown.security +
        staticResult.breakdown.conventions +
        normResult.normalization,
      breakdown: {
        performance: staticResult.breakdown.performance,
        security: staticResult.breakdown.security,
        conventions: staticResult.breakdown.conventions,
        normalization: normResult.normalization,
      },
      issues: [...staticResult.issues, ...normResult.issues],
      summary: normResult.summary,
    };

    return NextResponse.json({ report });
  } catch (err) {
    return apiError(err, 'Analyze API error');
  }
}
