import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, getClientIdentifier } from '@/lib/auth/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the configured max', () => {
    const scope = `test-scope-${Math.random()}`;
    const id = 'user-a';
    for (let i = 0; i < 3; i += 1) {
      const result = checkRateLimit(scope, id, { windowMs: 60_000, max: 3 });
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks once the max is exceeded within the window', () => {
    const scope = `test-scope-${Math.random()}`;
    const id = 'user-b';
    const options = { windowMs: 60_000, max: 2 };
    expect(checkRateLimit(scope, id, options).allowed).toBe(true);
    expect(checkRateLimit(scope, id, options).allowed).toBe(true);
    const third = checkRateLimit(scope, id, options);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('tracks each identifier independently', () => {
    const scope = `test-scope-${Math.random()}`;
    const options = { windowMs: 60_000, max: 1 };
    expect(checkRateLimit(scope, 'user-c', options).allowed).toBe(true);
    expect(checkRateLimit(scope, 'user-c', options).allowed).toBe(false);
    // A different identifier under the same scope has its own budget.
    expect(checkRateLimit(scope, 'user-d', options).allowed).toBe(true);
  });

  it('tracks each scope independently for the same identifier', () => {
    const options = { windowMs: 60_000, max: 1 };
    const id = 'shared-user';
    expect(checkRateLimit('scope-1', id, options).allowed).toBe(true);
    // A different scope (e.g. 'register' vs 'login') has its own budget.
    expect(checkRateLimit('scope-2', id, options).allowed).toBe(true);
  });

  it('resets the window after it elapses', () => {
    vi.useFakeTimers();
    const scope = `test-scope-${Math.random()}`;
    const id = 'user-e';
    const options = { windowMs: 1_000, max: 1 };

    expect(checkRateLimit(scope, id, options).allowed).toBe(true);
    expect(checkRateLimit(scope, id, options).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(checkRateLimit(scope, id, options).allowed).toBe(true);
    vi.useRealTimers();
  });
});

describe('getClientIdentifier', () => {
  it('extracts the first IP from x-forwarded-for', () => {
    const request = new Request('http://localhost/api/auth/login', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    expect(getClientIdentifier(request)).toBe('203.0.113.5');
  });

  it('falls back to "unknown" when the header is absent', () => {
    const request = new Request('http://localhost/api/auth/login');
    expect(getClientIdentifier(request)).toBe('unknown');
  });
});
