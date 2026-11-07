const mockRequestSessionSync = jest.fn();
const mockGetConnections = jest.fn();
jest.mock('@/src/api/wearables', () => ({
  requestSessionSync: (...args: unknown[]) => mockRequestSessionSync(...args),
  getConnections: (...args: unknown[]) => mockGetConnections(...args),
}));

const mockSyncAppleHealth = jest.fn();
jest.mock('../sync', () => ({
  syncAppleHealth: (...args: unknown[]) => mockSyncAppleHealth(...args),
}));

const mockSyncHealthConnect = jest.fn();
jest.mock('../healthConnectSync', () => ({
  syncHealthConnect: (...args: unknown[]) => mockSyncHealthConnect(...args),
}));

const mockGetAccess = jest.fn();
jest.mock('../healthConnectNative', () => ({
  __esModule: true,
  default: { getAccess: (...args: unknown[]) => mockGetAccess(...args) },
}));

const mockRegisterBackground = jest.fn();
jest.mock('../healthConnectBackground', () => ({
  registerHealthConnectBackgroundSync: (...args: unknown[]) => mockRegisterBackground(...args),
}));

import { runDeviceAutoSync } from '../deviceAutoSync';
import {
  _resetDeviceSyncStoreForTests,
  getDeviceDataVersion,
  getDeviceSyncing,
  subscribeDeviceSync,
} from '../deviceSyncStore';

const apple = (lastSyncAt: string | null = '2026-10-09T08:00:00.000Z') => ({
  provider: 'APPLE_HEALTH',
  status: 'device_push',
  lastSyncAt,
});
const healthConnect = (lastSyncAt: string | null = '2026-11-06T08:00:00.000Z') => ({
  provider: 'HEALTH_CONNECT',
  status: 'device_push',
  lastSyncAt,
});
const ouraFresh = { provider: 'OURA', status: 'fresh', lastSyncAt: '2026-10-10T11:58:00.000Z' };
const ouraQueued = { provider: 'OURA', status: 'queued', jobId: 'j1', lastSyncAt: '2026-10-10T08:00:00.000Z' };

beforeEach(() => {
  _resetDeviceSyncStoreForTests();
  mockRequestSessionSync.mockReset();
  mockGetConnections.mockReset();
  mockSyncAppleHealth.mockReset().mockResolvedValue({ status: 'synced', days: 7, result: {} });
  mockSyncHealthConnect.mockReset().mockResolvedValue({ status: 'synced', days: 7, result: {} });
  mockGetAccess.mockReset().mockResolvedValue({ granted: true, background: false, history: false });
  mockRegisterBackground.mockReset().mockResolvedValue(true);
});

describe('runDeviceAutoSync', () => {
  it('on iPhone pushes Apple Health right away (from the server-reported lastSyncAt) and tells screens to reload', async () => {
    mockRequestSessionSync.mockResolvedValue({ queued: false, providers: [apple(), ouraFresh] });

    await runDeviceAutoSync('ios');

    expect(mockSyncAppleHealth).toHaveBeenCalledWith('2026-10-09T08:00:00.000Z');
    expect(getDeviceDataVersion()).toBe(1);
    expect(getDeviceSyncing()).toBe(false);
  });

  it('never touches HealthKit on web/Android', async () => {
    mockRequestSessionSync.mockResolvedValue({ queued: false, providers: [apple()] });

    await runDeviceAutoSync('android');
    await runDeviceAutoSync('web');

    expect(mockSyncAppleHealth).not.toHaveBeenCalled();
    expect(getDeviceDataVersion()).toBe(0);
  });

  it('does not reload screens when Apple Health had nothing new', async () => {
    mockSyncAppleHealth.mockResolvedValue({ status: 'no_data' });
    mockRequestSessionSync.mockResolvedValue({ queued: false, providers: [apple()] });

    await runDeviceAutoSync('ios');

    expect(getDeviceDataVersion()).toBe(0);
  });

  it('waits for a queued Oura sync, shows the syncing state meanwhile, then reloads screens', async () => {
    jest.useFakeTimers();
    try {
      mockRequestSessionSync.mockResolvedValue({ queued: true, providers: [ouraQueued] });
      mockGetConnections
        .mockResolvedValueOnce([{ provider: 'OURA', lastSyncAt: '2026-10-10T08:00:00.000Z' }])
        .mockResolvedValueOnce([{ provider: 'OURA', lastSyncAt: '2026-10-10T12:00:09.000Z' }]);
      const seenSyncing: boolean[] = [];
      subscribeDeviceSync(() => seenSyncing.push(getDeviceSyncing()));

      const run = runDeviceAutoSync('android');
      await jest.advanceTimersByTimeAsync(5000);
      expect(getDeviceSyncing()).toBe(true);
      await jest.advanceTimersByTimeAsync(5000);
      await run;

      expect(mockGetConnections).toHaveBeenCalledTimes(2);
      expect(getDeviceDataVersion()).toBe(1);
      expect(getDeviceSyncing()).toBe(false);
      expect(seenSyncing).toContain(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('still reloads for Oura when the Apple Health push fails', async () => {
    jest.useFakeTimers();
    try {
      mockSyncAppleHealth.mockRejectedValue(new Error('HealthKit denied'));
      mockRequestSessionSync.mockResolvedValue({ queued: true, providers: [apple(), ouraQueued] });
      mockGetConnections.mockResolvedValue([{ provider: 'OURA', lastSyncAt: '2026-10-10T12:00:09.000Z' }]);

      const run = runDeviceAutoSync('ios');
      await jest.advanceTimersByTimeAsync(5000);
      await run;

      expect(getDeviceDataVersion()).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('swallows a failing session-sync request (offline, signed out) without side effects', async () => {
    mockRequestSessionSync.mockRejectedValue(new Error('Network request failed'));

    await expect(runDeviceAutoSync('ios')).resolves.toBeUndefined();

    expect(mockSyncAppleHealth).not.toHaveBeenCalled();
    expect(getDeviceDataVersion()).toBe(0);
    expect(getDeviceSyncing()).toBe(false);
  });

  describe('Health Connect (Android)', () => {
    it('on Android pushes Health Connect without showing any permission screen, and tells screens to reload', async () => {
      mockRequestSessionSync.mockResolvedValue({ queued: false, providers: [healthConnect(), ouraFresh] });

      await runDeviceAutoSync('android');

      expect(mockSyncHealthConnect).toHaveBeenCalledWith('2026-11-06T08:00:00.000Z', { interactive: false });
      expect(getDeviceDataVersion()).toBe(1);
      expect(mockSyncAppleHealth).not.toHaveBeenCalled();
    });

    it('never touches Health Connect on iPhone or web', async () => {
      mockRequestSessionSync.mockResolvedValue({ queued: false, providers: [healthConnect()] });

      await runDeviceAutoSync('ios');
      await runDeviceAutoSync('web');

      expect(mockSyncHealthConnect).not.toHaveBeenCalled();
      expect(getDeviceDataVersion()).toBe(0);
    });

    it('schedules the periodic background sync only when background reading was allowed', async () => {
      mockRequestSessionSync.mockResolvedValue({ queued: false, providers: [healthConnect()] });

      await runDeviceAutoSync('android');
      expect(mockRegisterBackground).not.toHaveBeenCalled();

      mockGetAccess.mockResolvedValue({ granted: true, background: true, history: true });
      await runDeviceAutoSync('android');
      expect(mockRegisterBackground).toHaveBeenCalledTimes(1);
    });

    it('does not reload screens (nor schedule anything) when access is missing', async () => {
      mockSyncHealthConnect.mockResolvedValue({ status: 'no_permission' });
      mockGetAccess.mockResolvedValue({ granted: false, background: true, history: false });
      mockRequestSessionSync.mockResolvedValue({ queued: false, providers: [healthConnect()] });

      await runDeviceAutoSync('android');

      expect(getDeviceDataVersion()).toBe(0);
      expect(mockRegisterBackground).not.toHaveBeenCalled();
    });

    it('swallows a failing Health Connect push', async () => {
      mockSyncHealthConnect.mockRejectedValue(new Error('SecurityException'));
      mockRequestSessionSync.mockResolvedValue({ queued: false, providers: [healthConnect()] });

      await expect(runDeviceAutoSync('android')).resolves.toBeUndefined();
      expect(getDeviceDataVersion()).toBe(0);
    });
  });
});
