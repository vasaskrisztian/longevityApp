import { describe, it, expect, vi, beforeEach } from 'vitest';

// authorization.ts imports UserRole as a value from '@prisma/client'. In this
// sandbox `prisma generate` could not run (see ARCHITECTURE.md /
// phase-1-summary.md), so the real @prisma/client package doesn't export a
// working UserRole enum object yet — mocking it here is what makes this
// suite able to exercise the REAL authorization.ts logic in isolation, and
// is harmless once `prisma generate` has run for real (a mock only ever
// applies inside this test file).
vi.mock('@prisma/client', () => ({
  UserRole: { USER: 'USER', ADMIN: 'ADMIN' },
}));

// Isolate authorization.ts from the real Auth.js config (which itself pulls
// in Prisma + argon2) — we only need to control what `auth()` resolves to.
const authMock = vi.fn();
vi.mock('@/lib/auth/auth', () => ({ auth: authMock }));

const { requireAuthenticatedUser, requireAdmin, requireOwnResourceOrAdmin, toErrorResponse, UnauthenticatedError, ForbiddenError } =
  await import('@/lib/auth/authorization');

function sessionFor(user: { id: string; role: 'USER' | 'ADMIN' }) {
  return { user };
}

beforeEach(() => {
  authMock.mockReset();
});

describe('requireAuthenticatedUser', () => {
  it('returns the session user when a session exists', async () => {
    authMock.mockResolvedValue(sessionFor({ id: 'u1', role: 'USER' }));
    await expect(requireAuthenticatedUser()).resolves.toEqual({ id: 'u1', role: 'USER' });
  });

  it('throws UnauthenticatedError when there is no session', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('throws UnauthenticatedError when the session has no user', async () => {
    authMock.mockResolvedValue({});
    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe('requireAdmin', () => {
  it('returns the user when role is ADMIN', async () => {
    authMock.mockResolvedValue(sessionFor({ id: 'admin1', role: 'ADMIN' }));
    await expect(requireAdmin()).resolves.toEqual({ id: 'admin1', role: 'ADMIN' });
  });

  it('throws ForbiddenError when role is USER', async () => {
    authMock.mockResolvedValue(sessionFor({ id: 'u1', role: 'USER' }));
    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws UnauthenticatedError (not ForbiddenError) when there is no session at all', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe('requireOwnResourceOrAdmin', () => {
  it('allows a user accessing their own resource', async () => {
    authMock.mockResolvedValue(sessionFor({ id: 'u1', role: 'USER' }));
    await expect(requireOwnResourceOrAdmin('u1')).resolves.toEqual({ id: 'u1', role: 'USER' });
  });

  it('allows an admin accessing someone else\'s resource', async () => {
    authMock.mockResolvedValue(sessionFor({ id: 'admin1', role: 'ADMIN' }));
    await expect(requireOwnResourceOrAdmin('someone-else')).resolves.toEqual({
      id: 'admin1',
      role: 'ADMIN',
    });
  });

  it('rejects a non-admin user accessing someone else\'s resource (IDOR/BOLA)', async () => {
    authMock.mockResolvedValue(sessionFor({ id: 'u1', role: 'USER' }));
    await expect(requireOwnResourceOrAdmin('u2')).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('toErrorResponse', () => {
  it('maps UnauthenticatedError to a 401 JSON response', async () => {
    const response = toErrorResponse(new UnauthenticatedError());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Authentication required');
  });

  it('maps ForbiddenError to a 403 JSON response', async () => {
    const response = toErrorResponse(new ForbiddenError('nope'));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('nope');
  });

  it('rethrows any other error unchanged', () => {
    const boom = new Error('unexpected');
    expect(() => toErrorResponse(boom)).toThrow(boom);
  });
});
