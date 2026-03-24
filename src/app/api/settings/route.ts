import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiError } from '@/lib/api-helpers';
import { updateSettingsSchema } from '@/lib/validations';
import type { AppSettings } from '@/lib/types';

/** GET /api/settings — Load all settings from DB */
export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
      key: string;
      value: string;
    }>;

    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }

    return NextResponse.json({ settings });
  } catch (err) {
    return apiError(err, 'GET /api/settings');
  }
}

/** PUT /api/settings — Update settings (partial, UPSERT) */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const result = updateSettingsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const db = getDb();
    const upsert = db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );

    const saveMany = db.transaction((entries: [string, unknown][]) => {
      for (const [key, value] of entries) {
        upsert.run(key, JSON.stringify(value));
      }
    });

    const entries = Object.entries(result.data).filter(
      ([, v]) => v !== undefined
    ) as [string, unknown][];

    saveMany(entries);

    // Return full settings after update
    const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
      key: string;
      value: string;
    }>;
    const settings: Partial<AppSettings> = {};
    for (const row of rows) {
      try {
        (settings as Record<string, unknown>)[row.key] = JSON.parse(row.value);
      } catch {
        (settings as Record<string, unknown>)[row.key] = row.value;
      }
    }

    return NextResponse.json({ settings });
  } catch (err) {
    return apiError(err, 'PUT /api/settings');
  }
}
