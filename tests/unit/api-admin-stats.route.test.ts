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

const getAdminStatsMock = vi.fn();
vi.mock('@/modules/admin/admin.service', () => ({
  getAdminStats: getAdminStatsMock,
}));

const { GET } = await import('@/app/api/admin/stats/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/stats', () => {
  it('returns 401 and never computes stats when unauthenticated', async () => {
    requireAdminMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getAdminStatsMock).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin, never computing stats', async () => {
    requireAdminMock.mockRejectedValue(new ForbiddenError('Admin role required'));

    const response = await GET();

    expect(response.status).toBe(403);
    expect(getAdminStatsMock).not.toHaveBeenCalled();
  });

  it('returns 200 with the service result as the body', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    const stats = { totalUsers: 10, ouraConnected: 3, authRequired: 1, failedSyncsToday: 0 };
    getAdminStatsMock.mockResolvedValue(stats);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(stats);
  });
});
