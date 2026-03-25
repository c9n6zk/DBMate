import { describe, it, expect, vi } from 'vitest';
import { getTemperature, withRetry } from '../ai-retry';
import { z } from 'zod/v4';

describe('getTemperature', () => {
  it('returns base temperature on attempt 0', () => {
    expect(getTemperature(0.3, 0)).toBe(0.3);
  });

  it('reduces by 0.05 per attempt', () => {
    expect(getTemperature(0.3, 1)).toBeCloseTo(0.25);
    expect(getTemperature(0.3, 2)).toBeCloseTo(0.2);
  });

  it('never goes below 0', () => {
    expect(getTemperature(0.05, 5)).toBe(0);
    expect(getTemperature(0.1, 10)).toBe(0);
  });
});

describe('withRetry', () => {
  const schema = z.object({ score: z.number() });

  it('returns on first success', async () => {
    const call = vi.fn().mockResolvedValue({ score: 42 });
    const result = await withRetry({ call, schema });
    expect(result).toEqual({ score: 42 });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries on validation failure', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ invalid: true })
      .mockResolvedValue({ score: 42 });
    const result = await withRetry({ call, schema });
    expect(result).toEqual({ score: 42 });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('retries on exception', async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValue({ score: 42 });
    const result = await withRetry({ call, schema });
    expect(result).toEqual({ score: 42 });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('passes lastError to next call', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ bad: true })
      .mockResolvedValue({ score: 42 });
    await withRetry({ call, schema });
    // Second call should receive lastError
    expect(call).toHaveBeenCalledWith(1, expect.stringContaining('validation failed'));
  });

  it('throws after maxRetries exhausted', async () => {
    const call = vi.fn().mockResolvedValue({ invalid: true });
    await expect(
      withRetry({ call, schema, maxRetries: 1 })
    ).rejects.toThrow();
    expect(call).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it('respects custom maxRetries', async () => {
    const call = vi.fn().mockResolvedValue({ invalid: true });
    await expect(
      withRetry({ call, schema, maxRetries: 0 })
    ).rejects.toThrow();
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('first call gets null as lastError', async () => {
    const call = vi.fn().mockResolvedValue({ score: 1 });
    await withRetry({ call, schema });
    expect(call).toHaveBeenCalledWith(0, null);
  });
});
