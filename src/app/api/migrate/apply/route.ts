import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api-helpers';

export async function POST(request: NextRequest) {
  try {
    const { id, appliedAt } = await request.json();
    if (!id || !appliedAt) {
      return NextResponse.json(
        { error: 'id and appliedAt are required' },
        { status: 400 }
      );
    }

    const db = getDb();
    db.prepare('UPDATE migrations SET applied_at = ? WHERE id = ?').run(
      appliedAt,
      id
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'Migrate apply error');
  }
}
