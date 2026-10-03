import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashToken } from '@/lib/auth/tokens';

const prismaMock = {
  mobileRefreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { issueMobileSession, rotateMobileRefreshToken, revokeMobileRefreshToken } = await import(
  '@/modules/auth/mobile-session.service'
);

const USER = { id: 'user-1', role: 'USER' as const, email: 'jane@example.com' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('issueMobileSession', () => {
  it('returns a signed access token and a raw refresh token, and persists only the refresh token\'s hash', async () => {
    prismaMock.mobileRefreshToken.create.mockResolvedValue({});

    const session = await issueMobileSession(USER);

    expect(session.accessToken).toEqual(expect.any(String));
    expect(session.refreshToken).toEqual(expect.any(String));
    expect(session.expiresIn).toBeGreaterThan(0);

    const createArgs = prismaMock.mobileRefreshToken.create.mock.calls[0]![0];
    expect(createArgs.data.userId).toBe('user-1');
    expect(createArgs.data.tokenHash).toBe(hashToken(session.refreshToken));
    expect(createArgs.data.expiresAt).toBeInstanceOf(Date);
  });
});

describe('rotateMobileRefreshToken', () => {
  it('returns null for an unknown token', async () => {
    prismaMock.mobileRefreshToken.findUnique.mockResolvedValue(null);

    await expect(rotateMobileRefreshToken('nope')).resolves.toBeNull();
    expect(prismaMock.mobileRefreshToken.update).not.toHaveBeenCalled();
  });

  it('returns null for an expired token', async () => {
    prismaMock.mobileRefreshToken.findUnique.mockResolvedValue({
      id: 'tok1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      user: USER,
    });

    await expect(rotateMobileRefreshToken('expired')).resolves.toBeNull();
    expect(prismaMock.mobileRefreshToken.update).not.toHaveBeenCalled();
  });

  it('revokes every active token for the user and returns null on reuse of an already-revoked token', async () => {
    prismaMock.mobileRefreshToken.findUnique.mockResolvedValue({
      id: 'tok1',
      userId: 'user-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: USER,
    });

    await expect(rotateMobileRefreshToken('stolen')).resolves.toBeNull();

    expect(prismaMock.mobileRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokes the old token and issues a fresh pair for a valid token', async () => {
    prismaMock.mobileRefreshToken.findUnique.mockResolvedValue({
      id: 'tok1',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: USER,
    });
    prismaMock.mobileRefreshToken.update.mockResolvedValue({});
    prismaMock.mobileRefreshToken.create.mockResolvedValue({});

    const session = await rotateMobileRefreshToken('valid');

    expect(session).not.toBeNull();
    expect(prismaMock.mobileRefreshToken.update).toHaveBeenCalledWith({
      where: { id: 'tok1' },
      data: { revokedAt: expect.any(Date) },
    });
    // A brand-new refresh token is issued, never the same raw value again.
    expect(session!.refreshToken).not.toBe('valid');
  });
});

describe('revokeMobileRefreshToken', () => {
  it('revokes only a still-active matching token', async () => {
    prismaMock.mobileRefreshToken.updateMany.mockResolvedValue({ count: 1 });

    await revokeMobileRefreshToken('some-token');

    expect(prismaMock.mobileRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hashToken('some-token'), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
