import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit } from '../rate-limiter';
import { AI_RATE_LIMIT } from '../validations';

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Reset time mocking
    vi.useRealTimers();
  });

  it('allows first request', () => {
    const result = checkRateLimit(`test-${Date.now()}`);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(AI_RATE_LIMIT - 1);
  });

  it('decrements remaining count', () => {
    const id = `decrement-${Date.now()}`;
    checkRateLimit(id);
    const result = checkRateLimit(id);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(AI_RATE_LIMIT - 2);
  });

  it('blocks after rate limit reached', () => {
    const id = `block-${Date.now()}`;
    for (let i = 0; i < AI_RATE_LIMIT; i++) {
      checkRateLimit(id);
    }
    const result = checkRateLimit(id);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets after window expires', () => {
    vi.useFakeTimers();
    const id = 'reset-test';

    // Use all slots
    for (let i = 0; i < AI_RATE_LIMIT; i++) {
      checkRateLimit(id);
    }
    expect(checkRateLimit(id).allowed).toBe(false);

    // Advance past 1-minute window
    vi.advanceTimersByTime(61_000);

    const result = checkRateLimit(id);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(AI_RATE_LIMIT - 1);
  });

  it('isolates sessions', () => {
    const idA = `session-a-${Date.now()}`;
    const idB = `session-b-${Date.now()}`;

    // Exhaust A
    for (let i = 0; i < AI_RATE_LIMIT; i++) {
      checkRateLimit(idA);
    }

    // B should still work
    const result = checkRateLimit(idB);
    expect(result.allowed).toBe(true);
  });

  it('returns resetAt in the future', () => {
    const id = `reset-at-${Date.now()}`;
    const result = checkRateLimit(id);
    expect(result.resetAt).toBeGreaterThan(Date.now() - 1000);
  });
});
