import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { getConnections } from '@/src/api/wearables';
import { syncHealthConnect } from './healthConnectSync';

export const HEALTH_CONNECT_BACKGROUND_TASK = 'longevity-health-connect-sync';

/** The system treats this as a minimum; Android typically runs it every few hours. */
const MINIMUM_INTERVAL_MINUTES = 60;

/**
 * The job body. Defined at module scope on purpose: when Android wakes the app
 * for the job there is no React tree, so the task must already be known when
 * the JS bundle loads (index.js imports this file before the router).
 * Never shows anything and never throws: no permission, no connection or a
 * network error simply ends the run (the next app open syncs anyway).
 */
TaskManager.defineTask(HEALTH_CONNECT_BACKGROUND_TASK, async () => {
  try {
    const connections = await getConnections();
    const connection = connections.find((c) => c.provider === 'HEALTH_CONNECT');
    if (!connection || connection.status !== 'CONNECTED') return BackgroundTask.BackgroundTaskResult.Success;
    await syncHealthConnect(connection.lastSyncAt, { interactive: false });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerHealthConnectBackgroundSync(): Promise<boolean> {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (await TaskManager.isTaskRegisteredAsync(HEALTH_CONNECT_BACKGROUND_TASK)) return true;
    await BackgroundTask.registerTaskAsync(HEALTH_CONNECT_BACKGROUND_TASK, {
      minimumInterval: MINIMUM_INTERVAL_MINUTES,
    });
    return true;
  } catch {
    return false;
  }
}

export async function unregisterHealthConnectBackgroundSync(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(HEALTH_CONNECT_BACKGROUND_TASK)) {
      await BackgroundTask.unregisterTaskAsync(HEALTH_CONNECT_BACKGROUND_TASK);
    }
  } catch {
    // Nothing to unregister.
  }
}
