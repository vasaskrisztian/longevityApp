import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  syncJob: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  wearableConnection: {
    findMany: vi.fn(),
  },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const {
  enqueueInitialSyncJob,
  enqueueManualSyncJob,
  enqueueDailySyncJobsForActiveConnections,
  markSyncJobRunning,
  completeSyncJob,
  completeSyncJobIfStillRunning,
} = await import('@/modules/wearable/services/sync-job.service');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('enqueueInitialSyncJob', () => {
  it('creates a QUEUED INITIAL SyncJob row scoped to the user, connection and provider', async () => {
    prismaMock.syncJob.create.mockResolvedValue({ id: 'job-1' });

    const result = await enqueueInitialSyncJob({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
    });

    expect(result).toEqual({ id: 'job-1' });
    expect(prismaMock.syncJob.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        connectionId: 'conn-1',
        provider: 'OURA',
        type: 'INITIAL',
        status: 'QUEUED',
      },
    });
  });
});

describe('enqueueManualSyncJob', () => {
  it('creates a QUEUED MANUAL SyncJob row scoped to the user, connection and provider', async () => {
    prismaMock.syncJob.create.mockResolvedValue({ id: 'job-2' });

    const result = await enqueueManualSyncJob({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
    });

    expect(result).toEqual({ id: 'job-2' });
    expect(prismaMock.syncJob.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        connectionId: 'conn-1',
        provider: 'OURA',
        type: 'MANUAL',
        status: 'QUEUED',
      },
    });
  });
});

describe('enqueueDailySyncJobsForActiveConnections', () => {
  it('queries only CONNECTED connections', async () => {
    prismaMock.wearableConnection.findMany.mockResolvedValue([]);

    await enqueueDailySyncJobsForActiveConnections();

    expect(prismaMock.wearableConnection.findMany).toHaveBeenCalledWith({
      where: { status: 'CONNECTED' },
      select: { id: true, userId: true, provider: true },
    });
  });

  it('returns an empty array and creates nothing when there are no active connections', async () => {
    prismaMock.wearableConnection.findMany.mockResolvedValue([]);

    const result = await enqueueDailySyncJobsForActiveConnections();

    expect(result).toEqual([]);
    expect(prismaMock.syncJob.create).not.toHaveBeenCalled();
  });

  it('creates one QUEUED DAILY SyncJob per active connection and returns their ids', async () => {
    prismaMock.wearableConnection.findMany.mockResolvedValue([
      { id: 'conn-1', userId: 'u1', provider: 'OURA' },
      { id: 'conn-2', userId: 'u2', provider: 'OURA' },
    ]);
    prismaMock.syncJob.create
      .mockResolvedValueOnce({ id: 'job-a' })
      .mockResolvedValueOnce({ id: 'job-b' });

    const result = await enqueueDailySyncJobsForActiveConnections();

    expect(prismaMock.syncJob.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.syncJob.create).toHaveBeenNthCalledWith(1, {
      data: { userId: 'u1', connectionId: 'conn-1', provider: 'OURA', type: 'DAILY', status: 'QUEUED' },
    });
    expect(prismaMock.syncJob.create).toHaveBeenNthCalledWith(2, {
      data: { userId: 'u2', connectionId: 'conn-2', provider: 'OURA', type: 'DAILY', status: 'QUEUED' },
    });
    expect(result).toEqual([
      { id: 'job-a', userId: 'u1', connectionId: 'conn-1', provider: 'OURA' },
      { id: 'job-b', userId: 'u2', connectionId: 'conn-2', provider: 'OURA' },
    ]);
  });
});

describe('markSyncJobRunning', () => {
  it('sets status RUNNING and stamps startedAt, keyed by jobId', async () => {
    prismaMock.syncJob.update.mockResolvedValue({});

    await markSyncJobRunning('job-1');

    expect(prismaMock.syncJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'RUNNING', startedAt: expect.any(Date) },
    });
  });
});

describe('completeSyncJob', () => {
  it('writes a SUCCESS result with all counts and null error fields', async () => {
    prismaMock.syncJob.update.mockResolvedValue({});

    await completeSyncJob('job-1', {
      status: 'SUCCESS',
      recordsFetched: 10,
      recordsCreated: 4,
      recordsUpdated: 6,
      datesUpserted: 3,
      workoutsUpserted: 1,
    });

    expect(prismaMock.syncJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: 'SUCCESS',
        finishedAt: expect.any(Date),
        recordsFetched: 10,
        recordsCreated: 4,
        recordsUpdated: 6,
        retryCount: 0,
        errorCode: null,
        errorMessage: null,
      },
    });
  });

  it('writes a FAILED result with its errorCode/errorMessage', async () => {
    prismaMock.syncJob.update.mockResolvedValue({});

    await completeSyncJob('job-1', {
      status: 'FAILED',
      recordsFetched: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      datesUpserted: 0,
      workoutsUpserted: 0,
      errorCode: 'AUTH_REQUIRED',
      errorMessage: 'refresh failed',
    });

    const call = prismaMock.syncJob.update.mock.calls[0]![0];
    expect(call.data.status).toBe('FAILED');
    expect(call.data.errorCode).toBe('AUTH_REQUIRED');
    expect(call.data.errorMessage).toBe('refresh failed');
  });

  it('defaults retryCount to 0 when the caller omits it', async () => {
    prismaMock.syncJob.update.mockResolvedValue({});

    await completeSyncJob('job-1', {
      status: 'SUCCESS',
      recordsFetched: 1,
      recordsCreated: 1,
      recordsUpdated: 0,
      datesUpserted: 1,
      workoutsUpserted: 0,
    });

    expect(prismaMock.syncJob.update.mock.calls[0]![0].data.retryCount).toBe(0);
  });

  it('passes through a non-zero retryCount from a retried job', async () => {
    prismaMock.syncJob.update.mockResolvedValue({});

    await completeSyncJob(
      'job-1',
      {
        status: 'SUCCESS',
        recordsFetched: 1,
        recordsCreated: 1,
        recordsUpdated: 0,
        datesUpserted: 1,
        workoutsUpserted: 0,
      },
      2,
    );

    expect(prismaMock.syncJob.update.mock.calls[0]![0].data.retryCount).toBe(2);
  });
});

describe('completeSyncJobIfStillRunning', () => {
  it('guards the write with status: RUNNING and returns true when it applied', async () => {
    prismaMock.syncJob.updateMany.mockResolvedValue({ count: 1 });

    const applied = await completeSyncJobIfStillRunning('job-1', {
      status: 'FAILED',
      recordsFetched: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      datesUpserted: 0,
      workoutsUpserted: 0,
      errorCode: 'FETCH_FAILED',
      errorMessage: 'hard timeout',
    });

    expect(applied).toBe(true);
    expect(prismaMock.syncJob.updateMany).toHaveBeenCalledWith({
      where: { id: 'job-1', status: 'RUNNING' },
      data: {
        status: 'FAILED',
        finishedAt: expect.any(Date),
        recordsFetched: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        retryCount: 0,
        errorCode: 'FETCH_FAILED',
        errorMessage: 'hard timeout',
      },
    });
  });

  it('returns false when the row was no longer RUNNING (a later attempt already owns it)', async () => {
    prismaMock.syncJob.updateMany.mockResolvedValue({ count: 0 });

    const applied = await completeSyncJobIfStillRunning('job-1', {
      status: 'SUCCESS',
      recordsFetched: 3,
      recordsCreated: 3,
      recordsUpdated: 0,
      datesUpserted: 3,
      workoutsUpserted: 0,
    });

    expect(applied).toBe(false);
  });
});
