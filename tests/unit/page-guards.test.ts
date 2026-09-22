import { describe, it, expect, vi, beforeEach } from 'vitest';
// Dependency-free — importing this does NOT pull in auth.ts/Auth.js/Prisma,
// unlike '@/lib/auth/authorization' (see src/lib/auth/errors.ts).
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';

// See authorization.test.ts for why UserRole needs mocking in this sandbox.
vi.mock('@prisma/client', () => ({
  UserRole: { USER: 'USER', ADMIN: 'ADMIN' },
}));

const requireAuthenticatedUserMock = vi.fn();
const requireAdminMock = vi.fn();

vi.mock('@/lib/auth/authorization', () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
  requireAdmin: requireAdminMock,
  UnauthenticatedError,
  ForbiddenError,
}));

const prismaMock = {
  user: { findUnique: vi.fn() },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

// next/navigation's real redirect() only works inside a Next.js request
// context; here we simulate its "interrupts execution" behavior by
// throwing a marker so we can assert both that it was called AND that it
// stopped the function from returning normally.
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

const { requireAuthenticatedUserForPage, requireAdminForPage, requireOnboardedUserForPage } =
  await import('@/lib/auth/page-guards');

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  requireAdminMock.mockReset();
  redirectMock.mockClear();
  prismaMock.user.findUnique.mockReset();
});

describe('requireAuthenticatedUserForPage', () => {
  it('returns the user when authenticated', async () => {
    const user = { id: 'u1', role: 'USER' as const };
    requireAuthenticatedUserMock.mockResolvedValue(user);

    await expect(requireAuthenticatedUserForPage()).resolves.toEqual(user);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects to /login when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    await expect(requireAuthenticatedUserForPage()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('rethrows an unrelated error instead of redirecting', async () => {
    const boom = new Error('db down');
    requireAuthenticatedUserMock.mockRejectedValue(boom);

    await expect(requireAuthenticatedUserForPage()).rejects.toThrow('db down');
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe('requireAdminForPage', () => {
  it('returns the user when they are an admin', async () => {
    const admin = { id: 'admin1', role: 'ADMIN' as const };
    requireAdminMock.mockResolvedValue(admin);

    await expect(requireAdminForPage()).resolves.toEqual(admin);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects to /login when unauthenticated', async () => {
    requireAdminMock.mockRejectedValue(new UnauthenticatedError());

    await expect(requireAdminForPage()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('redirects to /dashboard when authenticated but not an admin', async () => {
    requireAdminMock.mockRejectedValue(new ForbiddenError());

    await expect(requireAdminForPage()).rejects.toThrow('NEXT_REDIRECT:/dashboard');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
  });

  it('rethrows an unrelated error instead of redirecting', async () => {
    const boom = new Error('db down');
    requireAdminMock.mockRejectedValue(boom);

    await expect(requireAdminForPage()).rejects.toThrow('db down');
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe('requireOnboardedUserForPage', () => {
  it('returns the user when onboarding is complete', async () => {
    const user = { id: 'u1', role: 'USER' as const };
    requireAuthenticatedUserMock.mockResolvedValue(user);
    prismaMock.user.findUnique.mockResolvedValue({ onboardingCompletedAt: new Date() });

    await expect(requireOnboardedUserForPage()).resolves.toEqual(user);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects to /onboarding when onboardingCompletedAt is null', async () => {
    const user = { id: 'u1', role: 'USER' as const };
    requireAuthenticatedUserMock.mockResolvedValue(user);
    prismaMock.user.findUnique.mockResolvedValue({ onboardingCompletedAt: null });

    await expect(requireOnboardedUserForPage()).rejects.toThrow('NEXT_REDIRECT:/onboarding');
    expect(redirectMock).toHaveBeenCalledWith('/onboarding');
  });

  it('redirects to /onboarding when the user record is missing', async () => {
    const user = { id: 'u1', role: 'USER' as const };
    requireAuthenticatedUserMock.mockResolvedValue(user);
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(requireOnboardedUserForPage()).rejects.toThrow('NEXT_REDIRECT:/onboarding');
  });

  it('exempts admins from the onboarding check entirely', async () => {
    const admin = { id: 'admin1', role: 'ADMIN' as const };
    requireAuthenticatedUserMock.mockResolvedValue(admin);

    await expect(requireOnboardedUserForPage()).resolves.toEqual(admin);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects to /login when unauthenticated (delegates to requireAuthenticatedUserForPage)', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    await expect(requireOnboardedUserForPage()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });
});
