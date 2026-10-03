import { describe, it, expect, vi, beforeEach } from 'vitest';

const checkRateLimitMock = vi.fn();
const getClientIdentifierMock = vi.fn();
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIdentifier: getClientIdentifierMock,
  AUTH_RATE_LIMIT: { windowMs: 900_000, max: 5 },
}));

const rotateMobileRefreshTokenMock = vi.fn();
vi.mock('@/modules/auth/mobile-session.service', () => ({
  rotateMobileRefreshToken: rotateMobileRefreshTokenMock,
}));

const { POST } = await import('@/app/api/mobile/auth/refresh/route');

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/mobile/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  checkRateLimitMock.mockReset().mockReturnValue({ allowed: true, remaining: 4, resetAt: 0 });
  getClientIdentifierMock.mockReset().mockReturnValue('127.0.0.1');
  rotateMobileRefreshTokenMock.mockReset();
});

describe('POST /api/mobile/auth/refresh', () => {
  it('returns 429 when rate-limited', async () => {
    checkRateLimitMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: 0 });

    const response = await POST(postRequest({ refreshToken: 'abc' }));

    expect(response.status).toBe(429);
    expect(rotateMobileRefreshTokenMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a missing refreshToken', async () => {
    const response = await POST(postRequest({}));
    expect(response.status).toBe(400);
  });

  it('returns 401 for an invalid/expired/reused token', async () => {
    rotateMobileRefreshTokenMock.mockResolvedValue(null);

    const response = await POST(postRequest({ refreshToken: 'stale' }));

    expect(response.status).toBe(401);
  });

  it('returns the new token pair for a valid token', async () => {
    rotateMobileRefreshTokenMock.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresIn: 900,
    });

    const response = await POST(postRequest({ refreshToken: 'valid' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 });
  });
});
