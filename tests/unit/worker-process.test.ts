import { describe, it, expect, vi, beforeEach } from 'vitest';

const startOuraInitialSyncWorkerMock = vi.fn();
vi.mock('@/jobs/oura-initial-sync.job', () => ({
  startOuraInitialSyncWorker: startOuraInitialSyncWorkerMock,
}));

const startOuraDailySyncWorkerMock = vi.fn();
vi.mock('@/jobs/oura-daily-sync.job', () => ({
  startOuraDailySyncWorker: startOuraDailySyncWorkerMock,
}));

const startOuraManualSyncWorkerMock = vi.fn();
vi.mock('@/jobs/oura-manual-sync.job', () => ({
  startOuraManualSyncWorker: startOuraManualSyncWorkerMock,
}));

const startDailySyncScanWorkerMock = vi.fn();
const scheduleDailySyncScanMock = vi.fn();
vi.mock('@/jobs/scheduler', () => ({
  startDailySyncScanWorker: startDailySyncScanWorkerMock,
  scheduleDailySyncScan: scheduleDailySyncScanMock,
}));

const startGroupChallengeFinalizeWorkerMock = vi.fn();
const scheduleGroupChallengeFinalizeMock = vi.fn();
vi.mock('@/jobs/group-challenge-finalize.job', () => ({
  startGroupChallengeFinalizeWorker: startGroupChallengeFinalizeWorkerMock,
  scheduleGroupChallengeFinalize: scheduleGroupChallengeFinalizeMock,
}));

const loggerMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock('@/lib/logging/logger', () => ({ logger: loggerMock }));

const { startWorkerProcess } = await import('@/jobs/worker-process');

beforeEach(() => {
  vi.clearAllMocks();
  scheduleDailySyncScanMock.mockResolvedValue(undefined);
  scheduleGroupChallengeFinalizeMock.mockResolvedValue(undefined);
});

describe('startWorkerProcess', () => {
  it('starts all five workers (initial, daily, manual, daily-scan, group-challenge finalize)', async () => {
    await startWorkerProcess();

    expect(startOuraInitialSyncWorkerMock).toHaveBeenCalled();
    expect(startOuraDailySyncWorkerMock).toHaveBeenCalled();
    expect(startOuraManualSyncWorkerMock).toHaveBeenCalled();
    expect(startDailySyncScanWorkerMock).toHaveBeenCalled();
    expect(startGroupChallengeFinalizeWorkerMock).toHaveBeenCalled();
  });

  it('registers the daily-scan repeatable scheduler', async () => {
    await startWorkerProcess();

    expect(scheduleDailySyncScanMock).toHaveBeenCalled();
  });

  it('registers the hourly group-challenge finalize scheduler', async () => {
    await startWorkerProcess();

    expect(scheduleGroupChallengeFinalizeMock).toHaveBeenCalled();
  });

  it('logs a startup message naming every queue', async () => {
    await startWorkerProcess();

    expect(loggerMock.info).toHaveBeenCalledWith(
      'worker_process_started',
      expect.objectContaining({
        queues:
          'oura-initial-sync, oura-daily-sync, oura-manual-sync, oura-daily-sync-scan, group-challenge-finalize',
      }),
    );
  });
});
