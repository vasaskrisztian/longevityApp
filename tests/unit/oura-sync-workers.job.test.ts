import { describe, it, expect, vi, beforeEach } from 'vitest';

const startSyncWorkerMock = vi.fn().mockReturnValue({ fake: 'worker' });
vi.mock('@/jobs/wearable-sync.job', () => ({ startSyncWorker: startSyncWorkerMock }));

const getOuraProviderMock = vi.fn().mockReturnValue({ id: 'OURA' });
vi.mock('@/modules/wearable/providers/oura/oura-provider', () => ({
  getOuraProvider: getOuraProviderMock,
}));

const { startOuraInitialSyncWorker } = await import('@/jobs/oura-initial-sync.job');
const { startOuraDailySyncWorker } = await import('@/jobs/oura-daily-sync.job');
const { startOuraManualSyncWorker } = await import('@/jobs/oura-manual-sync.job');

beforeEach(() => {
  vi.clearAllMocks();
  getOuraProviderMock.mockReturnValue({ id: 'OURA' });
});

describe('startOuraInitialSyncWorker', () => {
  it('starts a worker on the INITIAL queue with the Oura adapter', () => {
    startOuraInitialSyncWorker();

    expect(startSyncWorkerMock).toHaveBeenCalledWith('oura-initial-sync', { id: 'OURA' });
  });
});

describe('startOuraDailySyncWorker', () => {
  it('starts a worker on the DAILY queue with the Oura adapter', () => {
    startOuraDailySyncWorker();

    expect(startSyncWorkerMock).toHaveBeenCalledWith('oura-daily-sync', { id: 'OURA' });
  });
});

describe('startOuraManualSyncWorker', () => {
  it('starts a worker on the MANUAL queue with the Oura adapter', () => {
    startOuraManualSyncWorker();

    expect(startSyncWorkerMock).toHaveBeenCalledWith('oura-manual-sync', { id: 'OURA' });
  });
});
