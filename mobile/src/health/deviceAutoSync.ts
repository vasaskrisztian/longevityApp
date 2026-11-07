import { Platform } from 'react-native';

import { getConnections, requestSessionSync } from '@/src/api/wearables';
import { bumpDeviceDataVersion, setDeviceSyncing } from './deviceSyncStore';
import { registerHealthConnectBackgroundSync } from './healthConnectBackground';
import native from './healthConnectNative';
import { syncHealthConnect } from './healthConnectSync';
import { runSessionSyncFlow, type SessionSyncEntry } from './sessionSyncFlow';
import { syncAppleHealth } from './sync';

/**
 * One login-time device sync, end to end:
 *  - server side: the session-sync endpoint queues an Oura sync if the data is
 *    stale and we then wait for it to land;
 *  - iPhone: if the server says Apple Health is connected (`device_push`), read
 *    HealthKit and upload at the same time, in parallel with that wait;
 *  - Android: the same for Health Connect (and, when the person allowed reading
 *    in the background, make sure the periodic background sync is scheduled).
 * Then tells the screens to reload if anything new arrived. Never throws —
 * everything here is background work; the next foreground simply tries again.
 */
export async function runDeviceAutoSync(platform: string = Platform.OS): Promise<void> {
  setDeviceSyncing(false);
  const pending: { apple?: Promise<boolean>; healthConnect?: Promise<boolean> } = {};

  try {
    const flow = await runSessionSyncFlow({
      requestSessionSync,
      getConnections,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      onResponse: (response) => {
        const apple = response.providers.find(
          (p: SessionSyncEntry) => p.provider === 'APPLE_HEALTH' && p.status === 'device_push',
        );
        if (apple && platform === 'ios') {
          pending.apple = pushAppleHealth(apple.lastSyncAt);
        }
        const healthConnect = response.providers.find(
          (p: SessionSyncEntry) => p.provider === 'HEALTH_CONNECT' && p.status === 'device_push',
        );
        if (healthConnect && platform === 'android') {
          pending.healthConnect = pushHealthConnect(healthConnect.lastSyncAt);
        }
      },
      onWaiting: () => setDeviceSyncing(true),
    });

    const appleUpdated = pending.apple ? await pending.apple : false;
    const healthConnectUpdated = pending.healthConnect ? await pending.healthConnect : false;
    if (flow.updated || appleUpdated || healthConnectUpdated) bumpDeviceDataVersion();
  } catch {
    // Silent by design (offline, 401 during sign-out, ...).
  } finally {
    setDeviceSyncing(false);
  }
}

async function pushAppleHealth(lastSyncAt: string | null): Promise<boolean> {
  try {
    const outcome = await syncAppleHealth(lastSyncAt);
    return outcome.status === 'synced';
  } catch {
    return false;
  }
}

async function pushHealthConnect(lastSyncAt: string | null): Promise<boolean> {
  try {
    // Automatic: never opens the Health Connect permission screen.
    const outcome = await syncHealthConnect(lastSyncAt, { interactive: false });
    if (outcome.status === 'synced' || outcome.status === 'no_data') {
      // Background reads only work when the person granted them; schedule the periodic job in that case.
      if ((await native.getAccess()).background) await registerHealthConnectBackgroundSync();
    }
    return outcome.status === 'synced';
  } catch {
    return false;
  }
}
