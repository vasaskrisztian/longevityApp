import { describe, it, expect, vi, beforeEach } from 'vitest';

const enqueueDailySyncJobsForActiveConnectionsMock = vi.fn();
vi.mock('@/modules/wearable/services/sync-job.service', () => ({
  enqueueDailySyncJobsForActiveConnections: enqueueDailySyncJobsForActiveConnectionsMock,
}));

const enqueueSyncJobToQueueMock = vi.fn();
const upsertJobSchedulerMock = vi.fn();
const getQueueMock = vi.fn().mockReturnValue({ upsertJobScheduler: upsertJobSchedulerMock });
vi.mock('@/lib/queue/queues', () => ({
  getQueue: getQueueMock,
  enqueueSyncJobToQueue: enqueueSyncJobToQueueMock,
  DAILY_SCAN_QUEUE_NAME: 'oura-daily-sync-scan',
}));

const WorkerMock = vi.fn().mockImplementation((queueName, processor, opts) => ({ queueName, processor, opts }));
vi.mock('bullmq', () => ({ Worker: WorkerMock }));

const getRedisConnectionMock = vi.fn().mockReturnValue({ fake: 'connection' });
vi.mock('@/lib/queue/connection', () => ({ getRedisConnection: getRedisConnectionMock }));

const { runDailySyncScan, scheduleDailySyncScan, startDailySyncScanWorker } = await import(
  '@/jobs/scheduler'
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runDailySyncScan', () => {
  it('creates zero queue pushes when there are no active connections', async () => {
    enqueueDailySyncJobsForActiveConnectionsMock.mockResolvedValue([]);

    const result = await runDailySyncScan();

    expect(result).toEqual({ enqueued: 0 });
    expect(enqueueSyncJobToQueueMock).not.toHaveBeenCalled();
  });

  it('pushes every created DAILY SyncJob onto the DAILY queue', async () => {
    enqueueDailySyncJobsForActiveConnectionsMock.mockResolvedValue([
      { id: 'job-a', userId: 'u1', connectionId: 'conn-1', provider: 'OURA' },
      { id: 'job-b', userId: 'u2', connectionId: 'conn-2', provider: 'OURA' },
    ]);

    const result = await runDailySyncScan();

    expect(result).toEqual({ enqueued: 2 });
    expect(enqueueSyncJobToQueueMock).toHaveBeenCalledWith('DAILY', 'job-a');
    expect(enqueueSyncJobToQueueMock).toHaveBeenCalledWith('DAILY', 'job-b');
    expect(enqueueSyncJobToQueueMock).toHaveBeenCalledTimes(2);
  });
});

describe('scheduleDailySyncScan', () => {
  it('upserts a repeatable job scheduler on the daily-scan queue with the daily cron pattern', async () => {
    await scheduleDailySyncScan();

    expect(getQueueMock).toHaveBeenCalledWith('oura-daily-sync-scan');
    expect(upsertJobSchedulerMock).toHaveBeenCalledWith(
      'daily-sync-scan',
      { pattern: '0 3 * * *' },
      { name: 'daily-scan' },
    );
  });
});

describe('startDailySyncScanWorker', () => {
  it('starts a worker on the daily-scan queue bound to the shared Redis connection', () => {
    startDailySyncScanWorker();

    expect(WorkerMock).toHaveBeenCalledWith(
      'oura-daily-sync-scan',
      expect.any(Function),
      expect.objectContaining({ connection: { fake: 'connection' } }),
    );
  });

  it("the worker's processor runs the daily sync scan", async () => {
    enqueueDailySyncJobsForActiveConnectionsMock.mockResolvedValue([]);
    startDailySyncScanWorker();

    const processor = WorkerMock.mock.calls[0]![1];
    await processor();

    expect(enqueueDailySyncJobsForActiveConnectionsMock).toHaveBeenCalled();
  });
});
