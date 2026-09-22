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

const getUserDetailForAdminMock = vi.fn();
const recordAdminViewUserMock = vi.fn();
vi.mock('@/modules/admin/admin.service', () => ({
  getUserDetailForAdmin: getUserDetailForAdminMock,
  recordAdminViewUser: recordAdminViewUserMock,
}));

const { GET } = await import('@/app/api/admin/users/[id]/dashboard/route');

function params(id: string) {
  return { params: { id } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/users/:id/dashboard', () => {
  // ARCHITECTURE.md §10.6's mandatory IDOR/BOLA case for this endpoint:
  // "As User A: GET /api/admin/users/{UserB.id} -> 403" — a non-admin never
  // even reaches the lookup, let alone another user's data.
  it('returns 403 for a non-admin caller, without ever reading the target user or auditing', async () => {
    requireAdminMock.mockRejectedValue(new ForbiddenError('Admin role required'));

    const response = await GET(new Request('https://example.com'), params('u2'));

    expect(response.status).toBe(403);
    expect(getUserDetailForAdminMock).not.toHaveBeenCalled();
    expect(recordAdminViewUserMock).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    requireAdminMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(new Request('https://example.com'), params('u2'));

    expect(response.status).toBe(401);
  });

  it('returns 404 and never audits when the target user does not exist', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    getUserDetailForAdminMock.mockResolvedValue(null);

    const response = await GET(new Request('https://example.com'), params('missing'));

    expect(response.status).toBe(404);
    expect(recordAdminViewUserMock).not.toHaveBeenCalled();
  });

  // ARCHITECTURE.md §10.6: "As Admin: GET /api/admin/users/{UserB.id} -> 200,
  // and an ADMIN_VIEW_USER AuditLog row is created."
  it('returns 200 with the user detail and writes an ADMIN_VIEW_USER audit row, for an admin', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const detail = { user: { id: 'u2' }, connection: {}, todaySnapshot: null, recentSyncJobs: [] };
    getUserDetailForAdminMock.mockResolvedValue(detail);

    const response = await GET(new Request('https://example.com'), params('u2'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(detail);
    expect(getUserDetailForAdminMock).toHaveBeenCalledWith('u2');
    expect(recordAdminViewUserMock).toHaveBeenCalledWith('admin-1', 'u2');
  });
});
