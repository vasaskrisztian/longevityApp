import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  syncJob: {
    findUnique: vi.fn(),
  },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const computeSyncWindowMock = vi.fn();
vi.mock('@/modules/wearable/services/sync-window.service', () => ({
  computeSyncWindow: computeSyncWindowMock,
}));

const markSyncJobRunningMock = vi.fn();
const completeSyncJobMock = vi.fn();
vi.mock('@/modules/wearable/services/sync-job.service', () => ({
  markSyncJobRunning: markSyncJobRunningMock,
  completeSyncJob: completeSyncJobMock,
}));

const runSyncForConnectionMock = vi.fn();
vi.mock('@/modules/wearable/services/sync.service', () => ({
  runSyncForConnection: runSyncForConnectionMock,
}));

const { runQueuedSyncJob, RetryableSyncJobError, SyncJobNotFoundError } = await import(
  '@/modules/wearable/services/sync-job-runner.service'
);

const FROM = new Date('2026-06-13T00:00:00Z');
const TO = new Date('2026-06-15T00:00:00Z');

const JOB_ROW = {
  id: 'job-1',
  userId: 'u1',
  connectionId: 'conn-1',
  provider: 'OURA',
  type: 'DAILY',
  connection: { lastSuccessfulSyncAt: new Date('2026-06-14T00:00:00Z') },
};

const FAKE_ADAPTER = { id: 'OURA' } as never;

function successResult() {
  return {
    status: 'SUCCESS' as const,
    recordsFetched: 5,
    recordsCreated: 2,
    recordsUpdated: 3,
    datesUpserted: 1,
    workoutsUpserted: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  computeSyncWindowMock.mockReturnValue({ from: FROM, to: TO });
});

describe('runQueuedSyncJob', () => {
  it('throws SyncJobNotFoundError when the job row does not exist, without touching anything else', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue(null);

    await expect(runQueuedSyncJob({ jobId: 'missing', adapter: FAKE_ADAPTER })).rejects.toThrow(
      SyncJobNotFoundError,
    );
    expect(markSyncJobRunningMock).not.toHaveBeenCalled();
    expect(runSyncForConnectionMock).not.toHaveBeenCalled();
  });

  it('loads the job scoped by id, including its connection', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue(JOB_ROW);
    runSyncForConnectionMock.mockResolvedValue(successResult());

    await runQueuedSyncJob({ jobId: 'job-1', adapter: FAKE_ADAPTER });

    expect(prismaMock.syncJob.findUnique).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      include: { connection: true },
    });
  });

  it('computes the sync window from the job type and the connection lastSuccessfulSyncAt', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue(JOB_ROW);
    runSyncForConnectionMock.mockResolvedValue(successResult());

    await runQueuedSyncJob({ jobId: 'job-1', adapter: FAKE_ADAPTER });

    expect(computeSyncWindowMock).toHaveBeenCalledWith({
      type: 'DAILY',
      lastSuccessfulSyncAt: JOB_ROW.connection.lastSuccessfulSyncAt,
      now: expect.any(Date),
    });
  });

  it('treats a missing connection as never-synced (null lastSuccessfulSyncAt)', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue({ ...JOB_ROW, connection: null });
    runSyncForConnectionMock.mockResolvedValue(successResult());

    await runQueuedSyncJob({ jobId: 'job-1', adapter: FAKE_ADAPTER });

    expect(computeSyncWindowMock).toHaveBeenCalledWith(
      expect.objectContaining({ lastSuccessfulSyncAt: null }),
    );
  });

  it('marks the job RUNNING before calling runSyncForConnection', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue(JOB_ROW);
    const order: string[] = [];
    markSyncJobRunningMock.mockImplementation(async () => {
      order.push('running');
    });
    runSyncForConnectionMock.mockImplementation(async () => {
      order.push('sync');
      return successResult();
    });

    await runQueuedSyncJob({ jobId: 'job-1', adapter: FAKE_ADAPTER });

    expect(order).toEqual(['running', 'sync']);
  });

  it('calls runSyncForConnection with the job identifiers, the adapter, and the computed window', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue(JOB_ROW);
    runSyncForConnectionMock.mockResolvedValue(successResult());

    await runQueuedSyncJob({ jobId: 'job-1', adapter: FAKE_ADAPTER });

    expect(runSyncForConnectionMock).toHaveBeenCalledWith({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      adapter: FAKE_ADAPTER,
      from: FROM,
      to: TO,
    });
  });

  it('writes the result back onto the SyncJob row with attemptsMade as retryCount', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue(JOB_ROW);
    const result = successResult();
    runSyncForConnectionMock.mockResolvedValue(result);

    await runQueuedSyncJob({ jobId: 'job-1', adapter: FAKE_ADAPTER, attemptsMade: 2 });

    expect(completeSyncJobMock).toHaveBeenCalledWith('job-1', result, 2);
  });

  it('defaults attemptsMade to 0 when the caller omits it', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue(JOB_ROW);
    runSyncForConnectionMock.mockResolvedValue(successResult());

    await runQueuedSyncJob({ jobId: 'job-1', adapter: FAKE_ADAPTER });

    expect(completeSyncJobMock).toHaveBeenCalledWith('job-1', expect.anything(), 0);
  });

  it('returns the SyncResult on SUCCESS without throwing', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue(JOB_ROW);
    const result = successResult();
    runSyncForConnectionMock.mockResolvedValue(result);

    await expect(runQueuedSyncJob({ jobId: 'job-1', adapter: FAKE_ADAPTER })).resolves.toEqual(result);
  });

  it('resolves normally (no throw) on a PARTIAL result — not retryable', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue(JOB_ROW);
    const partial = { ...successResult(), status: 'PARTIAL' as const, errorCode: 'PARTIAL_FETCH_FAILURE' };
    runSyncForConnectionMock.mockResolvedValue(partial);

    await expect(runQueuedSyncJob({ jobId: 'job-1', adapter: FAKE_ADAPTER })).resolves.toEqual(partial);
  });

  it('resolves normally (no throw) on a FAILED/AUTH_REQUIRED result — retrying would hit the same rejection', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue(JOB_ROW);
    const failed = {
      ...successResult(),
      status: 'FAILED' as const,
      errorCode: 'AUTH_REQUIRED',
      errorMessage: 'refresh rejected',
    };
    runSyncForConnectionMock.mockResolvedValue(failed);

    await expect(runQueuedSyncJob({ jobId: 'job-1', adapter: FAKE_ADAPTER })).resolves.toEqual(failed);
  });

  it('throws RetryableSyncJobError on a FAILED/FETCH_FAILED result, after already writing it to the job row', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue(JOB_ROW);
    const failed = {
      ...successResult(),
      status: 'FAILED' as const,
      errorCode: 'FETCH_FAILED',
      errorMessage: 'oura down',
    };
    runSyncForConnectionMock.mockResolvedValue(failed);

    await expect(runQueuedSyncJob({ jobId: 'job-1', adapter: FAKE_ADAPTER })).rejects.toThrow(
      RetryableSyncJobError,
    );
    expect(completeSyncJobMock).toHaveBeenCalledWith('job-1', failed, 0);
  });

  it('falls back to errorCode in the RetryableSyncJobError message when errorMessage is absent', async () => {
    prismaMock.syncJob.findUnique.mockResolvedValue(JOB_ROW);
    const failed = { ...successResult(), status: 'FAILED' as const, errorCode: 'FETCH_FAILED' };
    runSyncForConnectionMock.mockResolvedValue(failed);

    await expect(runQueuedSyncJob({ jobId: 'job-1', adapter: FAKE_ADAPTER })).rejects.toThrow(
      /FETCH_FAILED/,
    );
  });
});
