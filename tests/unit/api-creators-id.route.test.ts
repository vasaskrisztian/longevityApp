import { describe, it, expect, vi, beforeEach } from 'vitest';

const getCreatorPublicProfileMock = vi.fn();
vi.mock('@/modules/creators/creators.service', () => ({
  getCreatorPublicProfile: getCreatorPublicProfileMock,
}));

const requireAuthenticatedUserMock = vi.fn();
vi.mock('@/lib/auth/authorization', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/errors')>('@/lib/auth/errors');
  return {
    requireAuthenticatedUser: requireAuthenticatedUserMock,
    toErrorResponse: (error: unknown) =>
      error instanceof actual.UnauthenticatedError
        ? Response.json({ error: 'Unauthenticated' }, { status: 401 })
        : Response.json({ error: 'Internal error' }, { status: 500 }),
  };
});

const { GET } = await import('@/app/api/creators/[id]/route');
const { UnauthenticatedError } = await import('@/lib/auth/errors');

function params(id: string) {
  return { params: { id } };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthenticatedUserMock.mockResolvedValue({ id: 'viewer-1', role: 'MEMBER' });
});

describe('GET /api/creators/[id] (full profile — registered users only)', () => {
  it('returns 401 without a session and never reads the profile', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(new Request('https://example.com'), params('u1'));

    expect(response.status).toBe(401);
    expect(getCreatorPublicProfileMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a nonexistent/non-creator/non-consenting id, with no distinguishing detail', async () => {
    getCreatorPublicProfileMock.mockResolvedValue(null);

    const response = await GET(new Request('https://example.com'), params('missing'));

    expect(response.status).toBe(404);
  });

  it('returns 200 with the shaped public profile for a signed-in user', async () => {
    getCreatorPublicProfileMock.mockResolvedValue({ id: 'u1', fullName: 'Ada Lovelace', protocols: [] });

    const response = await GET(new Request('https://example.com'), params('u1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fullName).toBe('Ada Lovelace');
  });
});
