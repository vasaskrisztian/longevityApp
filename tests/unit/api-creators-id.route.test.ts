import { describe, it, expect, vi, beforeEach } from 'vitest';

const getCreatorPublicProfileMock = vi.fn();
vi.mock('@/modules/creators/creators.service', () => ({
  getCreatorPublicProfile: getCreatorPublicProfileMock,
}));

const { GET } = await import('@/app/api/creators/[id]/route');

function params(id: string) {
  return { params: { id } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/creators/[id] (public, no auth)', () => {
  it('returns 404 for a nonexistent/non-creator/non-consenting id, with no distinguishing detail', async () => {
    getCreatorPublicProfileMock.mockResolvedValue(null);

    const response = await GET(new Request('https://example.com'), params('missing'));

    expect(response.status).toBe(404);
  });

  it('returns 200 with the shaped public profile', async () => {
    getCreatorPublicProfileMock.mockResolvedValue({ id: 'u1', fullName: 'Ada Lovelace', protocols: [] });

    const response = await GET(new Request('https://example.com'), params('u1'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fullName).toBe('Ada Lovelace');
  });
});
