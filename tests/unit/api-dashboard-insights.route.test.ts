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

const getInsightsMock = vi.fn();
vi.mock('@/modules/dashboard/insights.service', () => ({ getInsights: getInsightsMock }));

const { GET } = await import('@/app/api/dashboard/insights/route');

beforeEach(() => {
  requireAuthenticatedUserMock.mockReset();
  getInsightsMock.mockReset();
});

describe('GET /api/dashboard/insights', () => {
  it('returns 401 and never calls the service when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());
    const response = await GET();
    expect(response.status).toBe(401);
    expect(getInsightsMock).not.toHaveBeenCalled();
  });

  it('returns the caller\'s own insights', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getInsightsMock.mockResolvedValue({ headline: 'Looking good', items: [], latestDataDate: null, baselineDays: 0, hasEnoughHistory: false });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(getInsightsMock).toHaveBeenCalledWith('u1');
    expect((await response.json()).headline).toBe('Looking good');
  });
});
