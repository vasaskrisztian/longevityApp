import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';

const requireAuthenticatedUserMock = vi.fn();

function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedError || error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

vi.mock('@/lib/auth/authorization', () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
  toErrorResponse,
  UnauthenticatedError,
  ForbiddenError,
}));

const getTodaySnapshotMock = vi.fn();
vi.mock('@/modules/dashboard/dashboard.service', () => ({
  getTodaySnapshot: getTodaySnapshotMock,
}));

const { GET } = await import('@/app/api/dashboard/route');

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  getTodaySnapshotMock.mockReset();
});

describe('GET /api/dashboard', () => {
  it('returns 401 and never calls the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getTodaySnapshotMock).not.toHaveBeenCalled();
  });

  it('propagates a 403 the same way as any other authorization failure', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new ForbiddenError('nope'));

    const response = await GET();

    expect(response.status).toBe(403);
    expect(getTodaySnapshotMock).not.toHaveBeenCalled();
  });

  it('fetches the snapshot scoped to the caller\'s own id — never a client-supplied id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getTodaySnapshotMock.mockResolvedValue({ date: new Date('2026-06-15'), isToday: true });

    const response = await GET();

    expect(getTodaySnapshotMock).toHaveBeenCalledWith('u1');
    expect(getTodaySnapshotMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it('returns null in the body when the user has no data yet, still with a 200', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getTodaySnapshotMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toBeNull();
  });
});
