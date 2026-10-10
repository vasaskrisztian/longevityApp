import { describe, it, expect, vi, beforeEach } from 'vitest';

const listConnectionsForUserMock = vi.fn();
vi.mock('@/modules/wearable/services/wearable.service', () => ({
  listConnectionsForUser: listConnectionsForUserMock,
}));

const findActiveSyncJobForConnectionMock = vi.fn();
const enqueueManualSyncJobMock = vi.fn();
const completeSyncJobMock = vi.fn();
vi.mock('@/modules/wearable/services/sync-job.service', () => ({
  findActiveSyncJobForConnection: findActiveSyncJobForConnectionMock,
  enqueueManualSyncJob: enqueueManualSyncJobMock,
  completeSyncJob: completeSyncJobMock,
}));

const enqueueSyncJobToQueueMock = vi.fn();
vi.mock('@/lib/queue/queues', () => ({ enqueueSyncJobToQueue: enqueueSyncJobToQueueMock }));

vi.mock('@/lib/logging/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const {
  requestSessionSync,
  SESSION_SYNC_STALE_AFTER_MS,
  SESSION_SYNC_IN_FLIGHT_WINDOW_MS,
} = await import('@/modules/wearable/services/session-sync.service');

const NOW = new Date('2026-10-10T12:00:00.000Z');

function connection(overrides: Record<string, unknown>) {
  return {
    id: 'conn-1',
    provider: 'OURA',
    status: 'CONNECTED',
    connectedAt: null,
    disconnectedAt: null,
    grantedScopes: [],
    lastSyncAt: null,
    lastSyncStatus: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findActiveSyncJobForConnectionMock.mockResolvedValue(null);
  enqueueManualSyncJobMock.mockResolvedValue({ id: 'job-1' });
  enqueueSyncJobToQueueMock.mockResolvedValue(undefined);
});

describe('requestSessionSync', () => {
  it('queues a MANUAL job for a connected Oura account that has never synced', async () => {
    listConnectionsForUserMock.mockResolvedValue([connection({}), connection({ id: null, provider: 'APPLE_HEALTH', status: 'DISCONNECTED' })]);

    const result = await requestSessionSync('u1', NOW);

    expect(enqueueManualSyncJobMock).toHaveBeenCalledWith({ userId: 'u1', connectionId: 'conn-1', provider: 'OURA' });
    expect(enqueueSyncJobToQueueMock).toHaveBeenCalledWith('MANUAL', 'job-1');
    expect(result).toEqual({
      queued: true,
      providers: [{ provider: 'OURA', status: 'queued', jobId: 'job-1', lastSyncAt: null }],
    });
  });

  it('queues when the last sync is older than the staleness window', async () => {
    const old = new Date(NOW.getTime() - SESSION_SYNC_STALE_AFTER_MS - 1000);
    listConnectionsForUserMock.mockResolvedValue([connection({ lastSyncAt: old })]);

    const result = await requestSessionSync('u1', NOW);

    expect(result.queued).toBe(true);
    expect(result.providers[0]).toMatchObject({ status: 'queued', lastSyncAt: old.toISOString() });
  });

  it('does not queue when the connection synced within the staleness window', async () => {
    const recent = new Date(NOW.getTime() - 60 * 1000);
    listConnectionsForUserMock.mockResolvedValue([connection({ lastSyncAt: recent })]);

    const result = await requestSessionSync('u1', NOW);

    expect(enqueueManualSyncJobMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      queued: false,
      providers: [{ provider: 'OURA', status: 'fresh', lastSyncAt: recent.toISOString() }],
    });
  });

  it('does not stack a second job on one that is already queued or running', async () => {
    findActiveSyncJobForConnectionMock.mockResolvedValue({ id: 'job-live' });
    listConnectionsForUserMock.mockResolvedValue([connection({})]);

    const result = await requestSessionSync('u1', NOW);

    expect(findActiveSyncJobForConnectionMock).toHaveBeenCalledWith(
      'conn-1',
      new Date(NOW.getTime() - SESSION_SYNC_IN_FLIGHT_WINDOW_MS),
    );
    expect(enqueueManualSyncJobMock).not.toHaveBeenCalled();
    expect(result.providers[0]).toMatchObject({ status: 'in_progress', jobId: 'job-live' });
    expect(result.queued).toBe(false);
  });

  it('asks the device to push for a connected Apple Health, without queueing anything', async () => {
    const last = new Date('2026-10-09T08:00:00.000Z');
    listConnectionsForUserMock.mockResolvedValue([connection({ id: 'conn-ah', provider: 'APPLE_HEALTH', lastSyncAt: last })]);

    const result = await requestSessionSync('u1', NOW);

    expect(enqueueManualSyncJobMock).not.toHaveBeenCalled();
    expect(result.providers).toEqual([{ provider: 'APPLE_HEALTH', status: 'device_push', lastSyncAt: last.toISOString() }]);
  });

  it('reports reconnect_required for AUTH_REQUIRED and ERROR connections and queues nothing', async () => {
    listConnectionsForUserMock.mockResolvedValue([connection({ status: 'AUTH_REQUIRED' })]);
    expect((await requestSessionSync('u1', NOW)).providers).toEqual([
      { provider: 'OURA', status: 'reconnect_required', lastSyncAt: null },
    ]);

    listConnectionsForUserMock.mockResolvedValue([connection({ status: 'ERROR' })]);
    expect((await requestSessionSync('u1', NOW)).providers[0]?.status).toBe('reconnect_required');
    expect(enqueueManualSyncJobMock).not.toHaveBeenCalled();
  });

  it('omits providers that are not connected at all', async () => {
    listConnectionsForUserMock.mockResolvedValue([
      connection({ id: null, status: 'DISCONNECTED' }),
      connection({ id: null, provider: 'APPLE_HEALTH', status: 'DISCONNECTED' }),
    ]);

    expect(await requestSessionSync('u1', NOW)).toEqual({ queued: false, providers: [] });
  });

  it('closes the job row and reports an error when pushing to the queue fails, without throwing', async () => {
    enqueueSyncJobToQueueMock.mockRejectedValue(new Error('redis down'));
    listConnectionsForUserMock.mockResolvedValue([connection({})]);

    const result = await requestSessionSync('u1', NOW);

    expect(completeSyncJobMock).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: 'FAILED', errorCode: 'ENQUEUE_FAILED', errorMessage: 'redis down' }),
    );
    expect(result).toEqual({ queued: false, providers: [{ provider: 'OURA', status: 'error', lastSyncAt: null }] });
  });
});
