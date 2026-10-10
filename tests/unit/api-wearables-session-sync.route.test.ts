import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthenticatedError } from '@/lib/auth/errors';

const requireAuthenticatedUserMock = vi.fn();
function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
vi.mock('@/lib/auth/authorization', () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
  toErrorResponse,
}));

const checkRateLimitMock = vi.fn();
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  SESSION_SYNC_RATE_LIMIT: { windowMs: 60_000, max: 10 },
}));

const requestSessionSyncMock = vi.fn();
vi.mock('@/modules/wearable/services/session-sync.service', () => ({
  requestSessionSync: requestSessionSyncMock,
}));

const { POST } = await import('@/app/api/wearables/session-sync/route');

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
});

describe('POST /api/wearables/session-sync', () => {
  it('returns 401 and does nothing when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST();

    expect(response.status).toBe(401);
    expect(requestSessionSyncMock).not.toHaveBeenCalled();
  });

  it('returns 429 without touching sync when the per-user limit is hit', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1' });
    checkRateLimitMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

    const response = await POST();

    expect(response.status).toBe(429);
    expect(checkRateLimitMock).toHaveBeenCalledWith('session-sync', 'u1', { windowMs: 60_000, max: 10 });
    expect(requestSessionSyncMock).not.toHaveBeenCalled();
  });

  it("scopes the sync to the authenticated user's id and returns the result", async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1' });
    const result = { queued: true, providers: [{ provider: 'OURA', status: 'queued', jobId: 'j1', lastSyncAt: null }] };
    requestSessionSyncMock.mockResolvedValue(result);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(requestSessionSyncMock).toHaveBeenCalledWith('u1');
  });
});
