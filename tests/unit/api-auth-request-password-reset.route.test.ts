import { describe, it, expect, vi, beforeEach } from 'vitest';

const checkRateLimitMock = vi.fn();
const getClientIdentifierMock = vi.fn();
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIdentifier: getClientIdentifierMock,
  AUTH_RATE_LIMIT: { windowMs: 900_000, max: 5 },
}));

const requestPasswordResetMock = vi.fn();
vi.mock('@/modules/auth/auth.service', () => ({
  requestPasswordReset: requestPasswordResetMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { POST } = await import('@/app/api/auth/request-password-reset/route');

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  checkRateLimitMock.mockReset().mockReturnValue({ allowed: true, remaining: 4, resetAt: 0 });
  getClientIdentifierMock.mockReset().mockReturnValue('127.0.0.1');
  requestPasswordResetMock.mockReset();
});

describe('POST /api/auth/request-password-reset', () => {
  it('returns 429 and never calls the service when rate-limited', async () => {
    checkRateLimitMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: 0 });

    const response = await POST(postRequest({ email: 'jane@example.com' }));

    expect(response.status).toBe(429);
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid email', async () => {
    const response = await POST(postRequest({ email: 'not-an-email' }));

    expect(response.status).toBe(400);
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an unparsable JSON body', async () => {
    const badRequest = new Request('http://localhost/api/auth/request-password-reset', {
      method: 'POST',
      body: 'not json',
    });

    const response = await POST(badRequest);

    expect(response.status).toBe(400);
  });

  it('returns the same generic 200 message for a known email (token issued)', async () => {
    requestPasswordResetMock.mockResolvedValue('raw-token-123');

    const response = await POST(postRequest({ email: 'jane@example.com' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toMatch(/password reset link/i);
  });

  it('returns the same generic 200 message for an unknown email (no enumeration)', async () => {
    requestPasswordResetMock.mockResolvedValue(null);

    const response = await POST(postRequest({ email: 'nobody@example.com' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toMatch(/password reset link/i);
  });

  it('still returns the same generic 200 message even when the service throws', async () => {
    requestPasswordResetMock.mockRejectedValue(new Error('db down'));

    const response = await POST(postRequest({ email: 'jane@example.com' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toMatch(/password reset link/i);
  });

  it('still succeeds when APP_URL is unset (falls back to a relative link)', async () => {
    // See the equivalent register-route test for why this is unset here
    // rather than left at tests/setup/env.ts's default.
    const original = process.env.APP_URL;
    delete process.env.APP_URL;
    requestPasswordResetMock.mockResolvedValue('raw-token-123');

    const response = await POST(postRequest({ email: 'jane@example.com' }));

    expect(response.status).toBe(200);
    process.env.APP_URL = original;
  });
});
