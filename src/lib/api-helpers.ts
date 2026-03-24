import { NextResponse } from 'next/server';

/**
 * Shared API error handler — extracts message from unknown error,
 * logs it with context, and returns a JSON error response.
 */
export function apiError(err: unknown, context: string, status = 500): NextResponse {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error(`${context}:`, err);
  return NextResponse.json({ error: message }, { status });
}
