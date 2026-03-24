import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api-helpers';
import { chatQuerySchema, saveChatSchema, chatDeleteSchema } from '@/lib/validations';
import type { ChatMessage } from '@/lib/types';

/** GET /api/chat?schemaId=X&limit=100 — Load chat messages for a schema */
export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const result = chatQuerySchema.safeParse(params);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { schemaId, limit } = result.data;
    const db = getDb();

    const rows = db.prepare(
      `SELECT id, schema_id, role, content, sql, confidence, type, created_at
       FROM chat_messages
       WHERE schema_id = ?
       ORDER BY created_at ASC
       LIMIT ?`
    ).all(schemaId, limit) as Array<{
      id: string;
      schema_id: string;
      role: 'user' | 'assistant';
      content: string;
      sql: string | null;
      confidence: string | null;
      type: string;
      created_at: string;
    }>;

    const messages: ChatMessage[] = rows.map((r) => ({
      id: r.id,
      schemaId: r.schema_id,
      role: r.role,
      content: r.content,
      sql: r.sql ?? undefined,
      confidence: r.confidence as ChatMessage['confidence'],
      type: r.type as ChatMessage['type'],
      timestamp: r.created_at,
    }));

    return NextResponse.json({ messages });
  } catch (err) {
    return apiError(err, 'GET /api/chat');
  }
}

/** POST /api/chat — Save chat messages (batch insert) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = saveChatSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const db = getDb();
    const insert = db.prepare(
      `INSERT OR REPLACE INTO chat_messages (id, schema_id, role, content, sql, confidence, type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertMany = db.transaction((msgs: typeof result.data.messages) => {
      for (const m of msgs) {
        insert.run(
          m.id,
          m.schemaId,
          m.role,
          m.content,
          m.sql ?? null,
          m.confidence ?? null,
          m.type,
          m.timestamp
        );
      }
    });

    insertMany(result.data.messages);

    return NextResponse.json({ ok: true, count: result.data.messages.length });
  } catch (err) {
    return apiError(err, 'POST /api/chat');
  }
}

/** DELETE /api/chat?schemaId=X — Delete all chat messages for a schema */
export async function DELETE(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const result = chatDeleteSchema.safeParse(params);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const db = getDb();
    const { changes } = db.prepare(
      `DELETE FROM chat_messages WHERE schema_id = ?`
    ).run(result.data.schemaId);

    return NextResponse.json({ ok: true, deleted: changes });
  } catch (err) {
    return apiError(err, 'DELETE /api/chat');
  }
}
