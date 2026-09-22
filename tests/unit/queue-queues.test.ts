import { describe, it, expect, vi, beforeEach } from 'vitest';

const addMock = vi.fn();
const QueueMock = vi.fn().mockImplementation(() => ({ add: addMock }));
vi.mock('bullmq', () => ({ Queue: QueueMock }));

const getRedisConnectionMock = vi.fn().mockReturnValue({ fake: 'connection' });
vi.mock('@/lib/queue/connection', () => ({ getRedisConnection: getRedisConnectionMock }));

const { SYNC_QUEUE_NAMES, getQueue, enqueueSyncJobToQueue, _resetQueuesForTests } = await import(
  '@/lib/queue/queues'
);

beforeEach(() => {
  QueueMock.mockClear();
  addMock.mockClear();
  _resetQueuesForTests();
});

describe('SYNC_QUEUE_NAMES', () => {
  it('has one distinct queue name per SyncJobType', () => {
    expect(SYNC_QUEUE_NAMES).toEqual({
      INITIAL: 'oura-initial-sync',
      DAILY: 'oura-daily-sync',
      MANUAL: 'oura-manual-sync',
    });
  });
});

describe('getQueue', () => {
  it('constructs a Queue bound to the shared Redis connection', () => {
    getQueue('some-queue');

    expect(QueueMock).toHaveBeenCalledWith('some-queue', { connection: { fake: 'connection' } });
  });

  it('is a singleton per queue name — a second call for the same name never constructs a second Queue', () => {
    getQueue('some-queue');
    getQueue('some-queue');

    expect(QueueMock).toHaveBeenCalledTimes(1);
  });

  it('constructs a separate Queue instance per distinct name', () => {
    getQueue('queue-a');
    getQueue('queue-b');

    expect(QueueMock).toHaveBeenCalledTimes(2);
  });
});

describe('enqueueSyncJobToQueue', () => {
  it('pushes onto the INITIAL queue for type INITIAL', async () => {
    await enqueueSyncJobToQueue('INITIAL', 'job-1');

    expect(QueueMock).toHaveBeenCalledWith('oura-initial-sync', expect.anything());
    expect(addMock).toHaveBeenCalledWith('sync', { jobId: 'job-1' }, expect.any(Object));
  });

  it('pushes onto the DAILY queue for type DAILY', async () => {
    await enqueueSyncJobToQueue('DAILY', 'job-2');

    expect(QueueMock).toHaveBeenCalledWith('oura-daily-sync', expect.anything());
  });

  it('pushes onto the MANUAL queue for type MANUAL', async () => {
    await enqueueSyncJobToQueue('MANUAL', 'job-3');

    expect(QueueMock).toHaveBeenCalledWith('oura-manual-sync', expect.anything());
  });

  it('sets the ARCHITECTURE.md §7.4 attempts/backoff job options', async () => {
    await enqueueSyncJobToQueue('MANUAL', 'job-4');

    const options = addMock.mock.calls[0]![2];
    expect(options.attempts).toBe(4);
    expect(options.backoff).toEqual({ type: 'sync-retry-schedule' });
  });

  it('reuses the same Queue instance across multiple calls of the same type', async () => {
    await enqueueSyncJobToQueue('DAILY', 'job-a');
    await enqueueSyncJobToQueue('DAILY', 'job-b');

    expect(QueueMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledTimes(2);
  });
});
