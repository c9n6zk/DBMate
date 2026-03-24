import Anthropic from '@anthropic-ai/sdk';
import type { Schema, ChatMessage } from '@/lib/types';
import { PROMPTS } from '@/lib/ai-prompts';

function buildSchemaContext(schema: Schema): string {
  const tableDescriptions = schema.tables.map((t) => {
    const cols = t.columns
      .map((c) => {
        const flags: string[] = [];
        if (c.primaryKey) flags.push('PK');
        if (c.autoIncrement) flags.push('AUTO');
        if (c.unique) flags.push('UNIQUE');
        if (!c.nullable) flags.push('NOT NULL');
        if (c.defaultValue) flags.push(`DEFAULT ${c.defaultValue}`);
        return `  - ${c.name} ${c.type}${flags.length ? ` [${flags.join(', ')}]` : ''}`;
      })
      .join('\n');

    const fks = t.foreignKeys
      .map(
        (fk) =>
          `  FK: ${fk.columns.join(',')} -> ${fk.referencedTable}(${fk.referencedColumns.join(',')})${fk.onDelete ? ` ON DELETE ${fk.onDelete}` : ''}`
      )
      .join('\n');

    return `TABLE ${t.name}:\n${cols}${fks ? '\n' + fks : ''}`;
  });

  return `## Current Schema: ${schema.name}
Dialect: ${schema.dialect}
Tables: ${schema.tables.length}

${tableDescriptions.join('\n\n')}`;
}

function buildMessages(
  question: string,
  schema: Schema,
  history: ChatMessage[]
): Anthropic.MessageParam[] {
  const schemaContext = buildSchemaContext(schema);

  const messages: Anthropic.MessageParam[] = [];

  // Add history (last N messages)
  for (const msg of history) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add current question with schema context
  messages.push({
    role: 'user',
    content: `${schemaContext}\n\n---\n\nUser question: ${question}`,
  });

  return messages;
}

// AI model used across all API routes
export const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-4-6';

/**
 * Format system prompt as array (required by claude-code-proxy).
 * When withCache=true and NOT in proxy mode, adds Anthropic prompt caching
 * (cache_control: ephemeral) to reduce token costs on repeated calls.
 */
export function systemPrompt(
  text: string,
  withCache = false
): Anthropic.MessageCreateParams['system'] {
  if (withCache && !isProxyMode()) {
    return [{
      type: 'text' as const,
      text,
      cache_control: { type: 'ephemeral' as const },
    }];
  }
  return [{ type: 'text' as const, text }];
}

/**
 * Detect if running through claude-code-proxy (no tool_use support).
 * Returns false for direct Anthropic API (api.anthropic.com).
 */
export function isProxyMode(): boolean {
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  return !!baseURL && !baseURL.includes('api.anthropic.com');
}

export function createAnthropicClient(): Anthropic {
  // If proxy base URL is set, use it (no API key needed)
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  if (baseURL) {
    return new Anthropic({ apiKey: 'not-needed', baseURL });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'sk-ant-your-key-here') {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in .env.local or set ANTHROPIC_BASE_URL for proxy.');
  }
  return new Anthropic({ apiKey });
}

/**
 * Heuristic confidence estimate for AI-generated SQL.
 * Checks schema alignment (unknown tables → low) and query complexity.
 */
export function estimateConfidence(
  sql: string,
  schema: Schema
): 'high' | 'medium' | 'low' {
  const tableNames = schema.tables.map((t) => t.name.toLowerCase());
  const sqlLower = sql.toLowerCase();

  // 1. References to non-existent tables → LOW
  const fromMatches =
    sqlLower.match(/(?:from|join)\s+[`"[\]]?(?:\w+\.)?(\w+)[`"\]]?/gi) || [];
  const referencedTables = fromMatches.map((m) => {
    const words = m.match(/\w+/g) || [];
    return words[words.length - 1]; // 'from' 'public' 'users' → 'users'
  });
  const unknownTables = referencedTables.filter(
    (t) => !tableNames.includes(t)
  );
  if (unknownTables.length > 0) return 'low';

  // 2. Complexity-based assessment
  const joinCount = (sqlLower.match(/\bjoin\b/gi) || []).length;
  const hasSubquery = /\bselect\b[\s\S]*\bselect\b/i.test(sql);

  if (joinCount === 0 && !hasSubquery) return 'high';
  if (joinCount <= 2 && !hasSubquery) return 'medium';
  return 'low';
}

export async function* streamChatResponse(
  question: string,
  schema: Schema,
  history: ChatMessage[]
): AsyncGenerator<{ type: 'text' | 'done'; content: string }> {
  const client = createAnthropicClient();
  const messages = buildMessages(question, schema, history);

  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 4096,
    temperature: 0.1,
    system: systemPrompt(PROMPTS.chat.system, true),
    messages,
  });

  let fullContent = '';

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      fullContent += event.delta.text;
      yield { type: 'text', content: event.delta.text };
    }
  }

  // Extract SQL from the full response (if any)
  const sqlMatch = fullContent.match(/```sql\n([\s\S]*?)```/);
  const sql = sqlMatch ? sqlMatch[1].trim() : '';
  const confidence = sql ? estimateConfidence(sql, schema) : null;

  yield {
    type: 'done',
    content: JSON.stringify({ fullContent, sql, confidence }),
  };
}
