import { describe, it, expect, vi, beforeEach } from 'vitest';

const checkRateLimitMock = vi.fn();
const getClientIdentifierMock = vi.fn();
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIdentifier: getClientIdentifierMock,
  AUTH_RATE_LIMIT: { windowMs: 900_000, max: 5 },
}));

const verifyUserCredentialsMock = vi.fn();
vi.mock('@/modules/auth/auth.service', () => ({
  verifyUserCredentials: verifyUserCredentialsMock,
}));

const issueMobileSessionMock = vi.fn();
vi.mock('@/modules/auth/mobile-session.service', () => ({
  issueMobileSession: issueMobileSessionMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { POST } = await import('@/app/api/mobile/auth/login/route');

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/mobile/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  checkRateLimitMock.mockReset().mockReturnValue({ allowed: true, remaining: 4, resetAt: 0 });
  getClientIdentifierMock.mockReset().mockReturnValue('127.0.0.1');
  verifyUserCredentialsMock.mockReset();
  issueMobileSessionMock.mockReset();
});

describe('POST /api/mobile/auth/login', () => {
  it('returns 429 and never checks credentials when rate-limited', async () => {
    checkRateLimitMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: 0 });

    const response = await POST(postRequest({ email: 'jane@example.com', password: 'whatever' }));

    expect(response.status).toBe(429);
    expect(verifyUserCredentialsMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid body', async () => {
    const response = await POST(postRequest({ email: 'not-an-email' }));
    expect(response.status).toBe(400);
  });

  it('returns 401 with a generic message for invalid credentials', async () => {
    verifyUserCredentialsMock.mockResolvedValue(null);

    const response = await POST(postRequest({ email: 'jane@example.com', password: 'wrong' }));

    expect(response.status).toBe(401);
    expect(issueMobileSessionMock).not.toHaveBeenCalled();
  });

  it('issues a session and returns the token pair + user for valid credentials', async () => {
    verifyUserCredentialsMock.mockResolvedValue({ id: 'u1', role: 'USER', email: 'jane@example.com' });
    issueMobileSessionMock.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
    });

    const response = await POST(postRequest({ email: 'jane@example.com', password: 'CorrectHorse123' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
      user: { id: 'u1', email: 'jane@example.com', role: 'USER' },
    });
  });
});
