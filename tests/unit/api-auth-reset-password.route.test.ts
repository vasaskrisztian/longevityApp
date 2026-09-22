import { describe, it, expect, vi, beforeEach } from 'vitest';

const checkRateLimitMock = vi.fn();
const getClientIdentifierMock = vi.fn();
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIdentifier: getClientIdentifierMock,
  AUTH_RATE_LIMIT: { windowMs: 900_000, max: 5 },
}));

const resetPasswordMock = vi.fn();
vi.mock('@/modules/auth/auth.service', () => ({
  resetPassword: resetPasswordMock,
}));

const { POST } = await import('@/app/api/auth/reset-password/route');

const VALID_RESET = {
  token: 'valid-token',
  password: 'NewPassword123',
  passwordConfirmation: 'NewPassword123',
};

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  checkRateLimitMock.mockReset().mockReturnValue({ allowed: true, remaining: 4, resetAt: 0 });
  getClientIdentifierMock.mockReset().mockReturnValue('127.0.0.1');
  resetPasswordMock.mockReset();
});

describe('POST /api/auth/reset-password', () => {
  it('returns 429 and never calls the service when rate-limited', async () => {
    checkRateLimitMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: 0 });

    const response = await POST(postRequest(VALID_RESET));

    expect(response.status).toBe(429);
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a password confirmation mismatch', async () => {
    const response = await POST(
      postRequest({ ...VALID_RESET, passwordConfirmation: 'Different123' }),
    );

    expect(response.status).toBe(400);
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an unparsable JSON body', async () => {
    const badRequest = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: 'not json',
    });

    const response = await POST(badRequest);

    expect(response.status).toBe(400);
  });

  it('returns 400 for an invalid or expired token', async () => {
    resetPasswordMock.mockResolvedValue(false);

    const response = await POST(postRequest(VALID_RESET));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/invalid or expired/i);
  });

  it('returns 200 for a successful reset', async () => {
    resetPasswordMock.mockResolvedValue(true);

    const response = await POST(postRequest(VALID_RESET));

    expect(response.status).toBe(200);
    expect(resetPasswordMock).toHaveBeenCalledWith('valid-token', 'NewPassword123');
  });
});
