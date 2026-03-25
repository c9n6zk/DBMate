import { describe, it, expect, vi } from 'vitest';
import { apiError } from '../api-helpers';

// Mock NextResponse.json
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}));

describe('apiError', () => {
  it('extracts message from Error instance', () => {
    const result = apiError(new Error('Something broke'), 'test context') as any;
    expect(result.body).toEqual({ error: 'Something broke' });
    expect(result.status).toBe(500);
  });

  it('returns "Unknown error" for non-Error objects', () => {
    const result = apiError('string error', 'test context') as any;
    expect(result.body).toEqual({ error: 'Unknown error' });
  });

  it('returns "Unknown error" for null', () => {
    const result = apiError(null, 'test context') as any;
    expect(result.body).toEqual({ error: 'Unknown error' });
  });

  it('uses custom status code', () => {
    const result = apiError(new Error('Not found'), 'test', 404) as any;
    expect(result.status).toBe(404);
  });

  it('defaults to status 500', () => {
    const result = apiError(new Error('fail'), 'test') as any;
    expect(result.status).toBe(500);
  });

  it('logs error with context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('test error');
    apiError(err, 'MyRoute');
    expect(spy).toHaveBeenCalledWith('MyRoute:', err);
    spy.mockRestore();
  });
});
