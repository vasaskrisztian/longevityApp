import { describe, it, expect, vi, beforeEach } from 'vitest';

const checkRateLimitMock = vi.fn();
const getClientIdentifierMock = vi.fn();
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIdentifier: getClientIdentifierMock,
  AUTH_RATE_LIMIT: { windowMs: 900_000, max: 5 },
}));

// Defined inline (rather than imported) so the mock factory owns the exact
// class identity the route's `instanceof` check compares against — see
// api-onboarding.route.test.ts and friends for the equivalent pattern using
// the real, dependency-free error classes from lib/auth/errors.ts (this
// module has no such extraction, but the class itself has no dependencies).
class EmailAlreadyRegisteredError extends Error {}

const registerUserMock = vi.fn();
vi.mock('@/modules/auth/auth.service', () => ({
  registerUser: registerUserMock,
  EmailAlreadyRegisteredError,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { POST } = await import('@/app/api/auth/register/route');

const VALID_REGISTRATION = {
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  password: 'CorrectHorse123',
  passwordConfirmation: 'CorrectHorse123',
  termsAccepted: true,
  privacyAccepted: true,
};

function postRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  checkRateLimitMock.mockReset().mockReturnValue({ allowed: true, remaining: 4, resetAt: 0 });
  getClientIdentifierMock.mockReset().mockReturnValue('127.0.0.1');
  registerUserMock.mockReset();
});

describe('POST /api/auth/register', () => {
  it('returns 429 and never calls the service when rate-limited', async () => {
    checkRateLimitMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: 0 });

    const response = await POST(postRequest(VALID_REGISTRATION));

    expect(response.status).toBe(429);
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload (password mismatch)', async () => {
    const response = await POST(
      postRequest({ ...VALID_REGISTRATION, passwordConfirmation: 'Different123' }),
    );

    expect(response.status).toBe(400);
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an unparsable JSON body', async () => {
    const badRequest = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: 'not json',
    });

    const response = await POST(badRequest);

    expect(response.status).toBe(400);
  });

  it('returns 201 with a generic message for a successful registration', async () => {
    registerUserMock.mockResolvedValue({ userId: 'u1', verificationToken: 'abc123' });

    const response = await POST(postRequest(VALID_REGISTRATION));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.message).toMatch(/verification link/i);
  });

  it('returns the same 201 generic message when the email is already registered (no enumeration)', async () => {
    registerUserMock.mockRejectedValue(new EmailAlreadyRegisteredError());

    const response = await POST(postRequest(VALID_REGISTRATION));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.message).toMatch(/verification link/i);
  });

  it('returns 500 for an unexpected service error (not the enumeration-safe path)', async () => {
    registerUserMock.mockRejectedValue(new Error('db down'));

    const response = await POST(postRequest(VALID_REGISTRATION));

    expect(response.status).toBe(500);
  });

  it('still succeeds when APP_URL is unset (falls back to a relative link)', async () => {
    // tests/setup/env.ts defaults APP_URL for the whole suite; unset it here
    // to exercise the `process.env.APP_URL ?? ''` fallback in
    // sendVerificationEmail, which a normal test run never hits otherwise.
    const original = process.env.APP_URL;
    delete process.env.APP_URL;
    registerUserMock.mockResolvedValue({ userId: 'u1', verificationToken: 'abc123' });

    const response = await POST(postRequest(VALID_REGISTRATION));

    expect(response.status).toBe(201);
    process.env.APP_URL = original;
  });
});
