import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashToken } from '@/lib/auth/tokens';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  profile: {
    create: vi.fn(),
  },
  emailVerificationToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  passwordResetToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  // auth.service.ts passes an array of already-invoked Prisma call
  // promises, matching real Prisma's `$transaction([...])` array form.
  $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
};

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const {
  registerUser,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  EmailAlreadyRegisteredError,
} = await import('@/modules/auth/auth.service');

const VALID_INPUT = {
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  password: 'CorrectHorse123',
  passwordConfirmation: 'CorrectHorse123',
  termsAccepted: true as const,
  privacyAccepted: true as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe('registerUser', () => {
  it('throws EmailAlreadyRegisteredError and creates nothing when the email exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(registerUser(VALID_INPUT)).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('creates the user, an argon2 password hash, a profile, and a single-use hashed verification token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'new-user-id' });
    prismaMock.emailVerificationToken.create.mockResolvedValue({});
    prismaMock.profile.create.mockResolvedValue({});

    const result = await registerUser(VALID_INPUT);

    expect(result.userId).toBe('new-user-id');
    expect(result.verificationToken).toEqual(expect.any(String));
    expect(result.verificationToken.length).toBeGreaterThan(20);

    // The password hash handed to Prisma is a real argon2id hash, never
    // the plaintext.
    const createArgs = prismaMock.user.create.mock.calls[0]![0];
    expect(createArgs.data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(createArgs.data.email).toBe('jane@example.com');
    expect(createArgs.data.termsAcceptedAt).toBeInstanceOf(Date);
    expect(createArgs.data.privacyAcceptedAt).toBeInstanceOf(Date);

    // Only the HASH of the verification token is persisted.
    const tokenArgs = prismaMock.emailVerificationToken.create.mock.calls[0]![0];
    expect(tokenArgs.data.userId).toBe('new-user-id');
    expect(tokenArgs.data.tokenHash).toBe(hashToken(result.verificationToken));

    const profileArgs = prismaMock.profile.create.mock.calls[0]![0];
    expect(profileArgs.data.userId).toBe('new-user-id');
    expect(profileArgs.data.fullName).toBe('Jane Doe');
  });
});

describe('verifyEmail', () => {
  it('returns false when the token does not exist', async () => {
    prismaMock.emailVerificationToken.findUnique.mockResolvedValue(null);
    await expect(verifyEmail('does-not-exist')).resolves.toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('returns false for an already-used token (single-use enforcement)', async () => {
    prismaMock.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'tok1',
      userId: 'u1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(verifyEmail('used-token')).resolves.toBe(false);
  });

  it('returns false for an expired token', async () => {
    prismaMock.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'tok1',
      userId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });
    await expect(verifyEmail('expired-token')).resolves.toBe(false);
  });

  it('marks the token used and verifies the user for a valid token', async () => {
    prismaMock.emailVerificationToken.findUnique.mockResolvedValue({
      id: 'tok1',
      userId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prismaMock.emailVerificationToken.update.mockResolvedValue({});
    prismaMock.user.update.mockResolvedValue({});

    await expect(verifyEmail('valid-token')).resolves.toBe(true);

    expect(prismaMock.emailVerificationToken.update).toHaveBeenCalledWith({
      where: { id: 'tok1' },
      data: { usedAt: expect.any(Date) },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });
});

describe('requestPasswordReset', () => {
  it('returns null and creates no token when the email is unknown (no enumeration)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(requestPasswordReset('nobody@example.com')).resolves.toBeNull();
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('creates a hashed, expiring token and returns the raw token for a known email', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'jane@example.com' });
    prismaMock.passwordResetToken.create.mockResolvedValue({});

    const rawToken = await requestPasswordReset('jane@example.com');

    expect(rawToken).toEqual(expect.any(String));
    const createArgs = prismaMock.passwordResetToken.create.mock.calls[0]![0];
    expect(createArgs.data.userId).toBe('u1');
    expect(createArgs.data.tokenHash).toBe(hashToken(rawToken as string));
    expect(createArgs.data.expiresAt).toBeInstanceOf(Date);
  });
});

describe('resetPassword', () => {
  it('returns false for an unknown token', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);
    await expect(resetPassword('nope', 'NewPassword123')).resolves.toBe(false);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('returns false for an already-used token', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'tok1',
      userId: 'u1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(resetPassword('used', 'NewPassword123')).resolves.toBe(false);
  });

  it('returns false for an expired token', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'tok1',
      userId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });
    await expect(resetPassword('expired', 'NewPassword123')).resolves.toBe(false);
  });

  it('hashes the new password and marks the token used for a valid token', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'tok1',
      userId: 'u1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prismaMock.passwordResetToken.update.mockResolvedValue({});
    prismaMock.user.update.mockResolvedValue({});

    await expect(resetPassword('valid', 'NewPassword123')).resolves.toBe(true);

    expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'tok1' },
      data: { usedAt: expect.any(Date) },
    });
    const userUpdateArgs = prismaMock.user.update.mock.calls[0]![0];
    expect(userUpdateArgs.where).toEqual({ id: 'u1' });
    expect(userUpdateArgs.data.passwordHash).toMatch(/^\$argon2id\$/);
  });
});
