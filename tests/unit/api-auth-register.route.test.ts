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

class InvitationError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}
vi.mock('@/modules/groups/invitations.service', () => ({ InvitationError }));

const sendEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/email/mailer', () => ({ sendEmail: sendEmailMock }));

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

  describe('with a group invitation token', () => {
    const WITH_INVITE = { ...VALID_REGISTRATION, inviteToken: 'tok', groupConsent: true };

    it('requires the explicit consent to share health data (400, service never called)', async () => {
      const response = await POST(postRequest({ ...WITH_INVITE, groupConsent: false }));
      expect(response.status).toBe(400);
      const response2 = await POST(postRequest({ ...VALID_REGISTRATION, inviteToken: 'tok' }));
      expect(response2.status).toBe(400);
      expect(registerUserMock).not.toHaveBeenCalled();
    });

    it('creates an already-verified account: 201, no verification email', async () => {
      sendEmailMock.mockClear();
      registerUserMock.mockResolvedValue({ userId: 'u1', verificationToken: null });

      const response = await POST(postRequest(WITH_INVITE));

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ verified: true });
      expect(sendEmailMock).not.toHaveBeenCalled();
      expect(registerUserMock).toHaveBeenCalledWith(expect.objectContaining({ inviteToken: 'tok', groupConsent: true }));
    });

    it.each([
      ['expired', /expired/i],
      ['email_mismatch', /different email/i],
      ['invalid', /not valid/i],
      ['accepted', /already been accepted/i],
    ])('maps a %s invitation to a specific 400', async (reason, message) => {
      registerUserMock.mockRejectedValue(new InvitationError(reason));
      const response = await POST(postRequest(WITH_INVITE));
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe(reason);
      expect(body.error).toMatch(message);
    });

    it('tells the holder of a valid invitation that the account exists (409 account_exists)', async () => {
      registerUserMock.mockRejectedValue(new EmailAlreadyRegisteredError());
      const response = await POST(postRequest(WITH_INVITE));
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe('account_exists');
    });
  });
});
