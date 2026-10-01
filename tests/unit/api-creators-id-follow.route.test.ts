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

const followCreatorMock = vi.fn();
const unfollowCreatorMock = vi.fn();
const isFollowingMock = vi.fn();
class CreatorNotFollowableError extends Error {}
vi.mock('@/modules/creators/creators.service', () => ({
  followCreator: followCreatorMock,
  unfollowCreator: unfollowCreatorMock,
  isFollowing: isFollowingMock,
  CreatorNotFollowableError,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { GET, POST, DELETE } = await import('@/app/api/creators/[id]/follow/route');

function params(id: string) {
  return { params: { id } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/creators/[id]/follow', () => {
  it('returns 401 when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());
    const response = await GET(new Request('https://example.com'), params('u2'));
    expect(response.status).toBe(401);
  });

  it('returns the follow state for the caller', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    isFollowingMock.mockResolvedValue(true);

    const response = await GET(new Request('https://example.com'), params('u2'));

    expect(isFollowingMock).toHaveBeenCalledWith('u1', 'u2');
    const body = await response.json();
    expect(body).toEqual({ following: true });
  });
});

describe('POST /api/creators/[id]/follow', () => {
  it('returns 401 when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());
    const response = await POST(new Request('https://example.com'), params('u2'));
    expect(response.status).toBe(401);
    expect(followCreatorMock).not.toHaveBeenCalled();
  });

  it('follows the creator and returns 200', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    followCreatorMock.mockResolvedValue(undefined);

    const response = await POST(new Request('https://example.com'), params('u2'));

    expect(followCreatorMock).toHaveBeenCalledWith('u1', 'u2');
    expect(response.status).toBe(200);
  });

  it('returns 404 when the target is not followable (self-follow or not an eligible creator)', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    followCreatorMock.mockRejectedValue(new CreatorNotFollowableError('Cannot follow yourself'));

    const response = await POST(new Request('https://example.com'), params('u1'));

    expect(response.status).toBe(404);
  });

  it('returns 500 when the service throws unexpectedly', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    followCreatorMock.mockRejectedValue(new Error('db down'));

    const response = await POST(new Request('https://example.com'), params('u2'));

    expect(response.status).toBe(500);
  });
});

describe('DELETE /api/creators/[id]/follow', () => {
  it('returns 401 when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());
    const response = await DELETE(new Request('https://example.com'), params('u2'));
    expect(response.status).toBe(401);
    expect(unfollowCreatorMock).not.toHaveBeenCalled();
  });

  it('unfollows the creator and returns 200', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    unfollowCreatorMock.mockResolvedValue(undefined);

    const response = await DELETE(new Request('https://example.com'), params('u2'));

    expect(unfollowCreatorMock).toHaveBeenCalledWith('u1', 'u2');
    expect(response.status).toBe(200);
  });
});
