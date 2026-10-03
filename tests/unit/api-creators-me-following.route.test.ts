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
}));

const listMyFollowingMock = vi.fn();
vi.mock('@/modules/creators/creators.service', () => ({
  listMyFollowing: listMyFollowingMock,
}));

const { GET } = await import('@/app/api/creators/me/following/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/creators/me/following', () => {
  it('returns 401 and never touches the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listMyFollowingMock).not.toHaveBeenCalled();
  });

  it("scopes the list to the caller's own id", async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    listMyFollowingMock.mockResolvedValue([]);

    await GET();

    expect(listMyFollowingMock).toHaveBeenCalledWith('u1');
  });

  it('returns the followed-creator summaries as JSON', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const following = [
      {
        id: 'creator-1',
        fullName: 'Ada Example',
        followedAt: new Date('2026-01-01T00:00:00.000Z'),
        publicProtocolCount: 2,
        publicChallengeCount: 1,
      },
    ];
    listMyFollowingMock.mockResolvedValue(following);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([
      {
        id: 'creator-1',
        fullName: 'Ada Example',
        followedAt: '2026-01-01T00:00:00.000Z',
        publicProtocolCount: 2,
        publicChallengeCount: 1,
      },
    ]);
  });
});
