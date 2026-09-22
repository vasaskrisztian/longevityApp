import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';

const requireAdminMock = vi.fn();
function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedError || error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
vi.mock('@/lib/auth/authorization', () => ({
  requireAdmin: requireAdminMock,
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

const userExistsForAdminMock = vi.fn();
const recordAdminTriggerSyncMock = vi.fn();
vi.mock('@/modules/admin/admin.service', () => ({
  userExistsForAdmin: userExistsForAdminMock,
  recordAdminTriggerSync: recordAdminTriggerSyncMock,
}));

const { POST } = await import('@/app/api/admin/users/[id]/sync/route');

function params(id: string) {
  return { params: { id } };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 0, resetAt: Date.now() + 300_000 });
  userExistsForAdminMock.mockResolvedValue(true);
});

describe('POST /api/admin/users/:id/sync', () => {
  it('returns 401 and never checks anything else when unauthenticated', async () => {
    requireAdminMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST(new Request('https://example.com'), params('u2'));

    expect(response.status).toBe(401);
    expect(userExistsForAdminMock).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-admin caller', async () => {
    requireAdminMock.mockRejectedValue(new ForbiddenError('Admin role required'));

    const response = await POST(new Request('https://example.com'), params('u2'));

    expect(response.status).toBe(403);
    expect(userExistsForAdminMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the target user does not exist', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    userExistsForAdminMock.mockResolvedValue(false);

    const response = await POST(new Request('https://example.com'), params('missing'));

    expect(response.status).toBe(404);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it('rate-limits keyed by the TARGET user id, not the admin', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: 'conn-1', status: 'CONNECTED' });
    enqueueManualSyncJobMock.mockResolvedValue({ id: 'job-1' });

    await POST(new Request('https://example.com'), params('u2'));

    expect(checkRateLimitMock).toHaveBeenCalledWith('manual-sync', 'u2', { windowMs: 300_000, max: 1 });
  });

  it('returns 429 and enqueues nothing when the rate limit is exceeded', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    checkRateLimitMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const response = await POST(new Request('https://example.com'), params('u2'));

    expect(response.status).toBe(429);
    expect(getConnectionForUserAndProviderMock).not.toHaveBeenCalled();
    expect(enqueueManualSyncJobMock).not.toHaveBeenCalled();
  });

  it('returns 409 when the target user has no CONNECTED Oura connection', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: null, status: 'DISCONNECTED' });

    const response = await POST(new Request('https://example.com'), params('u2'));

    expect(response.status).toBe(409);
    expect(enqueueManualSyncJobMock).not.toHaveBeenCalled();
  });

  it('on success: enqueues a MANUAL SyncJob for the target user, pushes it onto the queue, audits ADMIN_TRIGGER_SYNC, and returns 202', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: 'conn-1', status: 'CONNECTED' });
    enqueueManualSyncJobMock.mockResolvedValue({ id: 'job-1' });

    const response = await POST(new Request('https://example.com'), params('u2'));

    expect(getConnectionForUserAndProviderMock).toHaveBeenCalledWith('u2', 'OURA');
    expect(enqueueManualSyncJobMock).toHaveBeenCalledWith({
      userId: 'u2',
      connectionId: 'conn-1',
      provider: 'OURA',
    });
    expect(enqueueSyncJobToQueueMock).toHaveBeenCalledWith('MANUAL', 'job-1');
    expect(recordAdminTriggerSyncMock).toHaveBeenCalledWith('admin-1', 'u2', 'job-1');
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body).toEqual({ jobId: 'job-1' });
  });
});
