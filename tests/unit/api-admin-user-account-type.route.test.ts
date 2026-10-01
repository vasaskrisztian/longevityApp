import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';

const requireAdminMock = vi.fn();
function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedError || error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
vi.mock('@/lib/auth/authorization', () => ({
  requireAdmin: requireAdminMock,
  toErrorResponse,
}));

const userExistsForAdminMock = vi.fn();
const setUserAccountTypeMock = vi.fn();
const recordAdminSetAccountTypeMock = vi.fn();
vi.mock('@/modules/admin/admin.service', () => ({
  userExistsForAdmin: userExistsForAdminMock,
  setUserAccountType: setUserAccountTypeMock,
  recordAdminSetAccountType: recordAdminSetAccountTypeMock,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { PATCH } = await import('@/app/api/admin/users/[id]/account-type/route');

function params(id: string) {
  return { params: { id } };
}

function patchRequest(body: unknown): Request {
  return new Request('https://example.com', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  userExistsForAdminMock.mockResolvedValue(true);
});

describe('PATCH /api/admin/users/:id/account-type', () => {
  it('returns 401 and never touches anything else when unauthenticated', async () => {
    requireAdminMock.mockRejectedValue(new UnauthenticatedError());

    const response = await PATCH(patchRequest({ accountType: 'CREATOR' }), params('u2'));

    expect(response.status).toBe(401);
    expect(userExistsForAdminMock).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin caller', async () => {
    requireAdminMock.mockRejectedValue(new ForbiddenError('Admin role required'));

    const response = await PATCH(patchRequest({ accountType: 'CREATOR' }), params('u2'));

    expect(response.status).toBe(403);
  });

  it('returns 404 when the target user does not exist', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    userExistsForAdminMock.mockResolvedValue(false);

    const response = await PATCH(patchRequest({ accountType: 'CREATOR' }), params('missing'));

    expect(response.status).toBe(404);
    expect(setUserAccountTypeMock).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid accountType value', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });

    const response = await PATCH(patchRequest({ accountType: 'SUPERUSER' }), params('u2'));

    expect(response.status).toBe(400);
    expect(setUserAccountTypeMock).not.toHaveBeenCalled();
  });

  it('grants CREATOR, writes the ADMIN_SET_ACCOUNT_TYPE audit row, and returns 200', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    setUserAccountTypeMock.mockResolvedValue(undefined);

    const response = await PATCH(patchRequest({ accountType: 'CREATOR' }), params('u2'));

    expect(setUserAccountTypeMock).toHaveBeenCalledWith('u2', 'CREATOR');
    expect(recordAdminSetAccountTypeMock).toHaveBeenCalledWith('admin-1', 'u2', 'CREATOR');
    expect(response.status).toBe(200);
  });

  it('returns 500 when the service throws', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    setUserAccountTypeMock.mockRejectedValue(new Error('db down'));

    const response = await PATCH(patchRequest({ accountType: 'MEMBER' }), params('u2'));

    expect(response.status).toBe(500);
  });
});
