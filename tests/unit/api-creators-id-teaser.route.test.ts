import { describe, it, expect, vi, beforeEach } from 'vitest';

const getCreatorTeaserMock = vi.fn();
vi.mock('@/modules/creators/creators.service', () => ({
  getCreatorTeaser: getCreatorTeaserMock,
}));

const checkRateLimitMock = vi.fn();
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIdentifier: () => '1.2.3.4',
}));

const { GET } = await import('@/app/api/creators/[id]/teaser/route');

function params(id: string) {
  return { params: { id } };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 59, resetAt: 0 });
});

describe('GET /api/creators/[id]/teaser (public, no auth)', () => {
  it('returns 404 with no distinguishing detail for a missing/non-creator/non-consenting id', async () => {
    getCreatorTeaserMock.mockResolvedValue(null);
    const response = await GET(new Request('https://example.com'), params('missing'));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('returns 200 with the teaser shape', async () => {
    const teaser = {
      id: 'u1',
      fullName: 'Ada Lovelace',
      memberSince: '2026-01-02T00:00:00.000Z',
      followerCount: 3,
      publicProtocolCount: 2,
      publicChallengeCount: 1,
      trackedDays: 120,
    };
    getCreatorTeaserMock.mockResolvedValue(teaser);
    const response = await GET(new Request('https://example.com'), params('u1'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(teaser);
  });

  it('is rate-limited per client and does not hit the service when limited', async () => {
    checkRateLimitMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: 0 });
    const response = await GET(new Request('https://example.com'), params('u1'));
    expect(response.status).toBe(429);
    expect(getCreatorTeaserMock).not.toHaveBeenCalled();
    expect(checkRateLimitMock).toHaveBeenCalledWith('creator-teaser', '1.2.3.4', expect.any(Object));
  });
});
