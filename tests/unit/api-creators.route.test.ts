import { describe, it, expect, vi, beforeEach } from 'vitest';

const listPublicCreatorsMock = vi.fn();
vi.mock('@/modules/creators/creators.service', () => ({
  listPublicCreators: listPublicCreatorsMock,
}));

const { GET } = await import('@/app/api/creators/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/creators (public, no auth)', () => {
  it('returns the public creator directory with no authentication check', async () => {
    listPublicCreatorsMock.mockResolvedValue([{ id: 'u1', fullName: 'Ada Lovelace' }]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([{ id: 'u1', fullName: 'Ada Lovelace' }]);
  });
});
