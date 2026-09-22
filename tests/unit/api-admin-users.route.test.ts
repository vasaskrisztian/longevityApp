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

const listUsersForAdminMock = vi.fn();
vi.mock('@/modules/admin/admin.service', () => ({
  listUsersForAdmin: listUsersForAdminMock,
}));

const { GET } = await import('@/app/api/admin/users/route');

function req(query = ''): Request {
  return new Request(`https://example.com/api/admin/users${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/users', () => {
  it('returns 401 and never lists users when unauthenticated', async () => {
    requireAdminMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(req());

    expect(response.status).toBe(401);
    expect(listUsersForAdminMock).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin, never listing users — the IDOR-relevant path for this endpoint', async () => {
    requireAdminMock.mockRejectedValue(new ForbiddenError('Admin role required'));

    const response = await GET(req());

    expect(response.status).toBe(403);
    expect(listUsersForAdminMock).not.toHaveBeenCalled();
  });

  it('defaults q/ouraStatus/page/pageSize when no query params are given', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    listUsersForAdminMock.mockResolvedValue({ users: [], total: 0, page: 1, pageSize: 20 });

    await GET(req());

    expect(listUsersForAdminMock).toHaveBeenCalledWith({
      q: undefined,
      ouraStatus: 'ALL',
      page: 1,
      pageSize: 20,
    });
  });

  it('parses q, ouraStatus, page, and pageSize from the query string', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    listUsersForAdminMock.mockResolvedValue({ users: [], total: 0, page: 2, pageSize: 10 });

    await GET(req('?q=jane&ouraStatus=CONNECTED&page=2&pageSize=10'));

    expect(listUsersForAdminMock).toHaveBeenCalledWith({
      q: 'jane',
      ouraStatus: 'CONNECTED',
      page: 2,
      pageSize: 10,
    });
  });

  it('rejects an invalid ouraStatus with 400 and never calls the service', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });

    const response = await GET(req('?ouraStatus=BOGUS'));

    expect(response.status).toBe(400);
    expect(listUsersForAdminMock).not.toHaveBeenCalled();
  });

  it('returns 200 with the service result as the body', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const result = { users: [{ id: 'u1' }], total: 1, page: 1, pageSize: 20 };
    listUsersForAdminMock.mockResolvedValue(result);

    const response = await GET(req());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(result);
  });
});
