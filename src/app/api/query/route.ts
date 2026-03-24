import { NextRequest } from 'next/server';
import { queryRequestSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limiter';
import { streamChatResponse } from '@/lib/ai-service';
import { getDb } from '@/lib/db';
import { nanoid } from 'nanoid';
import type { Schema, ChatMessage } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (use IP as session ID)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'anonymous';
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded. Try again in a minute.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(
              Math.ceil((rateCheck.resetAt - Date.now()) / 1000)
            ),
          },
        }
      );
    }

    const body = await request.json();
    const result = queryRequestSchema.safeParse(body);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return new Response(JSON.stringify({ error: firstError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { question, schema, history, dialect } = result.data;
    const typedSchema = schema as unknown as Schema;
    const typedHistory = (history ?? []) as unknown as ChatMessage[];

    // Override dialect in schema context if provided
    if (dialect) {
      typedSchema.dialect = dialect;
    }

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamChatResponse(
            question,
            typedSchema,
            typedHistory
          )) {
            const data = JSON.stringify(chunk);
            controller.enqueue(
              encoder.encode(`data: ${data}\n\n`)
            );

            // On done, persist to query_history
            if (chunk.type === 'done') {
              try {
                const parsed = JSON.parse(chunk.content);
                const queryId = `query_${nanoid()}`;
                const db = getDb();
                db.prepare(
                  `INSERT INTO query_history (id, schema_id, nl_input, sql_output, explanation, confidence, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
                ).run(
                  queryId,
                  typedSchema.id,
                  question,
                  parsed.sql || '',
                  parsed.fullContent,
                  parsed.confidence || null
                );

                // FIFO cleanup: keep max 100 entries per schema
                db.prepare(
                  `DELETE FROM query_history WHERE schema_id = ? AND id NOT IN (
                     SELECT id FROM query_history WHERE schema_id = ? ORDER BY created_at DESC LIMIT 100
                   )`
                ).run(typedSchema.id, typedSchema.id);
              } catch {
                // Non-critical: don't fail the response if DB write fails
                console.error('Failed to persist query to history');
              }
            }
          }
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', content: errorMsg })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-RateLimit-Remaining': String(rateCheck.remaining),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Query API error:', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
