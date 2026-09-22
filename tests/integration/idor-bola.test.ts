import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';

/**
 * Phase 9 (ARCHITECTURE.md §12): "IDOR tests" — this file is the one
 * canonical place that reproduces §10.6's mandatory scenario literally,
 * line by line, rather than leaving it implicit across each route's own
 * test file (which also cover it, but not quoted against the spec):
 *
 *   As User A:
 *     GET /api/admin/users/{UserB.id}              -> 403
 *     GET /api/dashboard?userId={UserB.id}          -> ignored/403 (own id
 *                                                      is derived from
 *                                                      session, not the
 *                                                      query param)
 *   As Admin:
 *     GET /api/admin/users/{UserB.id}               -> 200, and an
 *                                                      ADMIN_VIEW_USER
 *                                                      AuditLog row is
 *                                                      created
 *
 * §10.6's own route (`GET /api/admin/users/:id`) doesn't literally exist —
 * §8.2's table defines `GET /api/admin/users/:id/dashboard` as the endpoint
 * that returns per-user data and is individually audited (see
 * docs/phase-8-summary.md's "Known limitations" for the same note) — so
 * that's the concrete route exercised here.
 */

const requireAuthenticatedUserMock = vi.fn();
const requireAdminMock = vi.fn();
function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedError || error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
vi.mock('@/lib/auth/authorization', () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
  requireAdmin: requireAdminMock,
  toErrorResponse,
}));

const getTodaySnapshotMock = vi.fn();
vi.mock('@/modules/dashboard/dashboard.service', () => ({
  getTodaySnapshot: getTodaySnapshotMock,
}));

const getUserDetailForAdminMock = vi.fn();
const recordAdminViewUserMock = vi.fn();
vi.mock('@/modules/admin/admin.service', () => ({
  getUserDetailForAdmin: getUserDetailForAdminMock,
  recordAdminViewUser: recordAdminViewUserMock,
}));

const { GET: getOwnDashboard } = await import('@/app/api/dashboard/route');
const { GET: getAdminUserDashboard } = await import('@/app/api/admin/users/[id]/dashboard/route');

const USER_A = { id: 'user-a', role: 'USER' as const };
const USER_B_ID = 'user-b';
const ADMIN = { id: 'admin-1', role: 'ADMIN' as const };

function adminDashboardParams(id: string) {
  return { params: { id } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('§10.6 — As User A (non-admin)', () => {
  it('GET /api/admin/users/{UserB.id}/dashboard -> 403, and UserB\'s data is never read or audited', async () => {
    requireAdminMock.mockRejectedValue(new ForbiddenError('Admin role required'));

    const response = await getAdminUserDashboard(new Request('https://example.com'), adminDashboardParams(USER_B_ID));

    expect(response.status).toBe(403);
    expect(getUserDetailForAdminMock).not.toHaveBeenCalled();
    expect(recordAdminViewUserMock).not.toHaveBeenCalled();
  });

  it('GET /api/dashboard?userId={UserB.id} -> the query param is ignored entirely; the route only ever resolves its own session id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue(USER_A);
    getTodaySnapshotMock.mockResolvedValue({ date: new Date('2026-06-15'), isToday: true });

    // The route handler takes no Request/params at all (see
    // src/app/api/dashboard/route.ts) — there is no code path through which
    // a `?userId=` query string could ever reach the service call below.
    // This request object (with UserB's id in the query string) is passed
    // only to document the attack this test rules out; GET() never reads it.
    const attackRequest = new Request(`https://example.com/api/dashboard?userId=${USER_B_ID}`);
    void attackRequest;

    const response = await getOwnDashboard();

    expect(response.status).toBe(200);
    expect(getTodaySnapshotMock).toHaveBeenCalledWith(USER_A.id);
    expect(getTodaySnapshotMock).not.toHaveBeenCalledWith(USER_B_ID);
  });
});

describe('§10.6 — As Admin', () => {
  it('GET /api/admin/users/{UserB.id}/dashboard -> 200, and an ADMIN_VIEW_USER AuditLog row is created', async () => {
    requireAdminMock.mockResolvedValue(ADMIN);
    const detail = { user: { id: USER_B_ID }, connection: {}, todaySnapshot: null, recentSyncJobs: [] };
    getUserDetailForAdminMock.mockResolvedValue(detail);

    const response = await getAdminUserDashboard(
      new Request('https://example.com'),
      adminDashboardParams(USER_B_ID),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(detail);
    expect(getUserDetailForAdminMock).toHaveBeenCalledWith(USER_B_ID);
    // The audit row: actor is the admin, target is UserB — never conflated.
    expect(recordAdminViewUserMock).toHaveBeenCalledWith(ADMIN.id, USER_B_ID);
  });
});
