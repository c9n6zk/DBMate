import type { z } from 'zod/v4';

interface AICallOptions<T> {
  /** AI call function — receives attempt number and previous error for feedback */
  call: (attempt: number, lastError: string | null) => Promise<unknown>;
  /** Zod schema to validate AI output */
  schema: z.ZodType<T>;
  /** Max retry attempts (default: 2, meaning up to 3 total calls) */
  maxRetries?: number;
  /** Base temperature — varies by endpoint (seed: 0.3, others: 0.1) */
  baseTemperature?: number;
}

/**
 * Calculate temperature for a retry attempt.
 * Reduces by 0.05 per attempt to get more deterministic outputs.
 */
export function getTemperature(base: number, attempt: number): number {
  return Math.max(0, base - attempt * 0.05);
}

/**
 * Retry wrapper for AI calls with Zod validation and error feedback.
 *
 * Flow:
 *   1. Call AI → validate with Zod
 *   2. If validation fails → retry with lower temperature + error feedback
 *   3. The `lastError` param lets the caller append retry hints to the prompt
 *
 * Rate limit note: checkRateLimit() is called ONCE at the route level,
 * retries are part of the same request and don't count separately.
 */
export async function withRetry<T>(opts: AICallOptions<T>): Promise<T> {
  const maxRetries = opts.maxRetries ?? 2;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const raw = await opts.call(attempt, lastError);
      const validation = opts.schema.safeParse(raw);
      if (validation.success) return validation.data;

      // Preserve error for next attempt's feedback
      lastError = `JSON validation failed: ${JSON.stringify(validation.error.issues.slice(0, 3))}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(lastError ?? 'AI call failed after retries');
}
