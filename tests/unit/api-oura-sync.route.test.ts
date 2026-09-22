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

const checkRateLimitMock = vi.fn();
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  MANUAL_SYNC_RATE_LIMIT: { windowMs: 5 * 60 * 1000, max: 1 },
}));

const getConnectionForUserAndProviderMock = vi.fn();
vi.mock('@/modules/wearable/services/wearable.service', () => ({
  getConnectionForUserAndProvider: getConnectionForUserAndProviderMock,
}));

const enqueueManualSyncJobMock = vi.fn();
vi.mock('@/modules/wearable/services/sync-job.service', () => ({
  enqueueManualSyncJob: enqueueManualSyncJobMock,
}));

const enqueueSyncJobToQueueMock = vi.fn();
vi.mock('@/lib/queue/queues', () => ({
  enqueueSyncJobToQueue: enqueueSyncJobToQueueMock,
}));

const { POST } = await import('@/app/api/integrations/oura/sync/route');

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 0, resetAt: Date.now() + 300_000 });
});

describe('POST /api/integrations/oura/sync', () => {
  it('returns 401 and never checks the rate limit or connection when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST();

    expect(response.status).toBe(401);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(getConnectionForUserAndProviderMock).not.toHaveBeenCalled();
  });

  it('propagates a 403 the same way as any other authorization failure', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new ForbiddenError('nope'));

    const response = await POST();

    expect(response.status).toBe(403);
  });

  it('rate-limits per authenticated userId, not per IP', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 0, resetAt: 0 });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: 'conn-1', status: 'CONNECTED' });
    enqueueManualSyncJobMock.mockResolvedValue({ id: 'job-1' });

    await POST();

    expect(checkRateLimitMock).toHaveBeenCalledWith('manual-sync', 'u1', { windowMs: 300_000, max: 1 });
  });

  it('returns 429 and never enqueues anything when the rate limit is exceeded', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    checkRateLimitMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const response = await POST();

    expect(response.status).toBe(429);
    expect(getConnectionForUserAndProviderMock).not.toHaveBeenCalled();
    expect(enqueueManualSyncJobMock).not.toHaveBeenCalled();
  });

  it('returns 409 when the user has no CONNECTED Oura connection', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: null, status: 'DISCONNECTED' });

    const response = await POST();

    expect(response.status).toBe(409);
    expect(enqueueManualSyncJobMock).not.toHaveBeenCalled();
  });

  it('returns 409 for an AUTH_REQUIRED connection — the user must reconnect before a manual sync makes sense', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: 'conn-1', status: 'AUTH_REQUIRED' });

    const response = await POST();

    expect(response.status).toBe(409);
    expect(enqueueManualSyncJobMock).not.toHaveBeenCalled();
  });

  it('on success: enqueues a MANUAL SyncJob scoped to the caller, pushes it onto the queue, and returns 202 with the jobId', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: 'conn-1', status: 'CONNECTED' });
    enqueueManualSyncJobMock.mockResolvedValue({ id: 'job-1' });

    const response = await POST();

    expect(getConnectionForUserAndProviderMock).toHaveBeenCalledWith('u1', 'OURA');
    expect(enqueueManualSyncJobMock).toHaveBeenCalledWith({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
    });
    expect(enqueueSyncJobToQueueMock).toHaveBeenCalledWith('MANUAL', 'job-1');
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body).toEqual({ jobId: 'job-1' });
  });
});
