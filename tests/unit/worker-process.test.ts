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

const loggerMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock('@/lib/logging/logger', () => ({ logger: loggerMock }));

const { startWorkerProcess } = await import('@/jobs/worker-process');

beforeEach(() => {
  vi.clearAllMocks();
  scheduleDailySyncScanMock.mockResolvedValue(undefined);
});

describe('startWorkerProcess', () => {
  it('starts all four workers (initial, daily, manual, daily-scan)', async () => {
    await startWorkerProcess();

    expect(startOuraInitialSyncWorkerMock).toHaveBeenCalled();
    expect(startOuraDailySyncWorkerMock).toHaveBeenCalled();
    expect(startOuraManualSyncWorkerMock).toHaveBeenCalled();
    expect(startDailySyncScanWorkerMock).toHaveBeenCalled();
  });

  it('registers the daily-scan repeatable scheduler', async () => {
    await startWorkerProcess();

    expect(scheduleDailySyncScanMock).toHaveBeenCalled();
  });

  it('logs a startup message naming every queue', async () => {
    await startWorkerProcess();

    expect(loggerMock.info).toHaveBeenCalledWith(
      'worker_process_started',
      expect.objectContaining({
        queues: 'oura-initial-sync, oura-daily-sync, oura-manual-sync, oura-daily-sync-scan',
      }),
    );
  });
});
