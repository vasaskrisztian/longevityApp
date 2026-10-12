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

// Bearer-token authentication — isolate from the real `next/headers`
// request context and the real JWT verification.
const headersGetMock = vi.fn();
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: headersGetMock })),
}));
const verifyMobileAccessTokenMock = vi.fn();
vi.mock('@/lib/auth/mobile-jwt', () => ({
  verifyMobileAccessToken: verifyMobileAccessTokenMock,
}));

const { requireAuthenticatedUser, requireAdmin, requireOwnResourceOrAdmin, toErrorResponse, UnauthenticatedError, ForbiddenError } =
  await import('@/lib/auth/authorization');

const headerFor = (token: string | null) => headersGetMock.mockReturnValue(token === null ? null : `Bearer ${token}`);
function bearerUser(user: { id: string; role: 'USER' | 'ADMIN'; email?: string }) {
  headerFor('a-valid-token');
  verifyMobileAccessTokenMock.mockResolvedValue({ sub: user.id, role: user.role, email: user.email });
}

beforeEach(() => {
  headersGetMock.mockReset().mockReturnValue(null);
  verifyMobileAccessTokenMock.mockReset();
});

describe('requireAuthenticatedUser', () => {
  it('returns the user behind a valid Bearer access token', async () => {
    bearerUser({ id: 'u1', role: 'USER', email: 'jane@example.com' });

    await expect(requireAuthenticatedUser()).resolves.toEqual({
      id: 'u1',
      role: 'USER',
      email: 'jane@example.com',
    });
    expect(verifyMobileAccessTokenMock).toHaveBeenCalledWith('a-valid-token');
  });

  it('throws UnauthenticatedError for an invalid/expired Bearer token', async () => {
    headerFor('garbage');
    verifyMobileAccessTokenMock.mockResolvedValue(null);

    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('throws UnauthenticatedError when there is no Authorization header at all', async () => {
    headerFor(null);

    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(verifyMobileAccessTokenMock).not.toHaveBeenCalled();
  });

  it('ignores an Authorization header that is not a Bearer token', async () => {
    headersGetMock.mockReturnValue('Basic dXNlcjpwYXNz');

    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(verifyMobileAccessTokenMock).not.toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  it('returns the user when role is ADMIN', async () => {
    bearerUser({ id: 'admin1', role: 'ADMIN' });
    await expect(requireAdmin()).resolves.toMatchObject({ id: 'admin1', role: 'ADMIN' });
  });

  it('throws ForbiddenError when role is USER', async () => {
    bearerUser({ id: 'u1', role: 'USER' });
    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws UnauthenticatedError (not ForbiddenError) when nobody is signed in', async () => {
    headerFor(null);
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe('requireOwnResourceOrAdmin', () => {
  it('allows a user accessing their own resource', async () => {
    bearerUser({ id: 'u1', role: 'USER' });
    await expect(requireOwnResourceOrAdmin('u1')).resolves.toMatchObject({ id: 'u1', role: 'USER' });
  });

  it('allows an admin accessing someone else\'s resource', async () => {
    bearerUser({ id: 'admin1', role: 'ADMIN' });
    await expect(requireOwnResourceOrAdmin('someone-else')).resolves.toMatchObject({
      id: 'admin1',
      role: 'ADMIN',
    });
  });

  it('rejects a non-admin user accessing someone else\'s resource (IDOR/BOLA)', async () => {
    bearerUser({ id: 'u1', role: 'USER' });
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
