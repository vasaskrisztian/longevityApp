import { Platform } from 'react-native';

import { getConnections, requestSessionSync } from '@/src/api/wearables';
import { bumpDeviceDataVersion, setDeviceSyncing } from './deviceSyncStore';
import { runSessionSyncFlow, type SessionSyncEntry } from './sessionSyncFlow';
import { syncAppleHealth } from './sync';

/**
 * One login-time device sync, end to end:
 *  - server side: the session-sync endpoint queues an Oura sync if the data is
 *    stale and we then wait for it to land;
 *  - iPhone: if the server says Apple Health is connected (`device_push`), read
 *    HealthKit and upload at the same time, in parallel with that wait.
 * Then tells the screens to reload if anything new arrived. Never throws —
 * everything here is background work; the next foreground simply tries again.
 */
export async function runDeviceAutoSync(platform: string = Platform.OS): Promise<void> {
  setDeviceSyncing(false);
  const pending: { apple?: Promise<boolean> } = {};

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
      },
      onWaiting: () => setDeviceSyncing(true),
    });

    const appleUpdated = pending.apple ? await pending.apple : false;
    if (flow.updated || appleUpdated) bumpDeviceDataVersion();
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
