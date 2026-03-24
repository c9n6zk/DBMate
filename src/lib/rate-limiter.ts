import { AI_RATE_LIMIT } from './validations';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000; // 1 minute window

export function checkRateLimit(sessionId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = store.get(sessionId);

  // Clean expired entries periodically
  if (store.size > 1000) {
    for (const [key, val] of store) {
      if (val.resetAt <= now) store.delete(key);
    }
  }

  if (!entry || entry.resetAt <= now) {
    // New window
    const resetAt = now + WINDOW_MS;
    store.set(sessionId, { count: 1, resetAt });
    return { allowed: true, remaining: AI_RATE_LIMIT - 1, resetAt };
  }

  if (entry.count >= AI_RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: AI_RATE_LIMIT - entry.count,
    resetAt: entry.resetAt,
  };
}
