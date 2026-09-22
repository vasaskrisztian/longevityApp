import { describe, it, expect, vi, beforeEach } from 'vitest';

const runQueuedSyncJobMock = vi.fn();
vi.mock('@/modules/wearable/services/sync-job-runner.service', () => ({
  runQueuedSyncJob: runQueuedSyncJobMock,
}));

const WorkerMock = vi.fn().mockImplementation((queueName, processor, opts) => ({ queueName, processor, opts }));
vi.mock('bullmq', () => ({ Worker: WorkerMock }));

const getRedisConnectionMock = vi.fn().mockReturnValue({ fake: 'connection' });
vi.mock('@/lib/queue/connection', () => ({ getRedisConnection: getRedisConnectionMock }));

const { createSyncQueueProcessor, startSyncWorker } = await import('@/jobs/wearable-sync.job');

const FAKE_ADAPTER = { id: 'OURA' } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSyncQueueProcessor', () => {
  it('delegates to runQueuedSyncJob with the job data and the given adapter', async () => {
    runQueuedSyncJobMock.mockResolvedValue({ status: 'SUCCESS' });
    const processor = createSyncQueueProcessor(FAKE_ADAPTER);

    await processor({ data: { jobId: 'job-1' }, attemptsMade: 2 });

    expect(runQueuedSyncJobMock).toHaveBeenCalledWith({
      jobId: 'job-1',
      adapter: FAKE_ADAPTER,
      attemptsMade: 2,
    });
  });

  it('propagates a rejection from runQueuedSyncJob (e.g. RetryableSyncJobError) so BullMQ sees the failure', async () => {
    const error = new Error('retryable');
    runQueuedSyncJobMock.mockRejectedValue(error);
    const processor = createSyncQueueProcessor(FAKE_ADAPTER);

    await expect(processor({ data: { jobId: 'job-1' }, attemptsMade: 1 })).rejects.toThrow('retryable');
  });

  it('returns whatever runQueuedSyncJob resolves with', async () => {
    const result = { status: 'PARTIAL' };
    runQueuedSyncJobMock.mockResolvedValue(result);
    const processor = createSyncQueueProcessor(FAKE_ADAPTER);

    await expect(processor({ data: { jobId: 'job-1' }, attemptsMade: 0 })).resolves.toBe(result);
  });
});

describe('startSyncWorker', () => {
  it('constructs a Worker for the given queue name, bound to the shared Redis connection', () => {
    startSyncWorker('some-queue', FAKE_ADAPTER);

    expect(WorkerMock).toHaveBeenCalledWith(
      'some-queue',
      expect.any(Function),
      expect.objectContaining({ connection: { fake: 'connection' } }),
    );
  });

  it('registers the sync-retry-policy backoff strategy on the worker', () => {
    startSyncWorker('some-queue', FAKE_ADAPTER);

    const opts = WorkerMock.mock.calls[0]![2];
    expect(typeof opts.settings.backoffStrategy).toBe('function');
    // attempt 1 -> 1 minute, per sync-retry-policy.ts's schedule.
    expect(opts.settings.backoffStrategy(1)).toBe(60_000);
  });
});
