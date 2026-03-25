import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '../rate-limiter';

describe('checkRateLimit - coverage gaps', () => {
  it('cleans expired entries when store exceeds 1000', () => {
    // Fill the store with 1001+ unique session IDs
    // Each will create a new entry, and when > 1000 the cleanup runs
    for (let i = 0; i < 1005; i++) {
      checkRateLimit(`cleanup-session-${i}`);
    }
    // After 1005 inserts, cleanup should have run
    // Just verify it doesn't crash and still works
    const result = checkRateLimit('cleanup-session-new');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it('cleanup preserves non-expired entries', () => {
    // This session was just created, should still work after cleanup
    const id = `preserve-test-${Date.now()}`;
    checkRateLimit(id);
    const result = checkRateLimit(id);
    expect(result.allowed).toBe(true);
  });
});
