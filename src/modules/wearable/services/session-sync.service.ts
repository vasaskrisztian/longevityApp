import { logger } from '@/lib/logging/logger';
import { enqueueSyncJobToQueue } from '@/lib/queue/queues';
import { isSupportedWearableProvider, type WearableProviderId } from '../domain/wearable-provider.types';
import { listConnectionsForUser } from './wearable.service';
import { completeSyncJob, enqueueManualSyncJob, findActiveSyncJobForConnection } from './sync-job.service';

/**
 * Login-time ("session") sync. Called by the web app and the mobile app the
 * moment a signed-in user opens them, so the data on screen is fresh without
 * anyone pressing "Sync now".
 *
 * What it does per connected device:
 *  - Server-pulled providers (Oura): enqueue a MANUAL SyncJob — unless one is
 *    already queued/running, or the connection was synced very recently. The
 *    staleness gate (not a rate limit) is what keeps a user who reloads the
 *    page ten times from queueing ten jobs; unlike the explicit "Sync now"
 *    button it never answers 429, because a silent background call has no
 *    way to show that to anyone.
 *  - Device-pushed providers (Apple Health): the server cannot pull anything;
 *    the entry only tells the iPhone app "yes, push your latest days now".
 *  - AUTH_REQUIRED / ERROR connections are reported so the UI can nudge a
 *    reconnect; nothing is queued for them.
 *
 * No schema change: auto syncs are recorded as MANUAL jobs (same window rule —
 * lastSuccessfulSyncAt minus a 2-day overlap — and same queue as a button tap).
 */

/** A connection that finished a sync attempt less than this long ago is "fresh" — no new job. */
export const SESSION_SYNC_STALE_AFTER_MS = 10 * 60 * 1000;

/** A QUEUED/RUNNING job younger than this counts as "still in flight". Covers the 4 min hard timeout plus the first retry delay. */
export const SESSION_SYNC_IN_FLIGHT_WINDOW_MS = 15 * 60 * 1000;

export type SessionSyncStatus =
  | 'queued'
  | 'in_progress'
  | 'fresh'
  | 'device_push'
  | 'reconnect_required'
  | 'error';

export interface SessionSyncEntry {
  provider: WearableProviderId;
  status: SessionSyncStatus;
  /** Present for `queued` / `in_progress`. */
  jobId?: string;
  /** The connection's lastSyncAt at request time (ISO) — clients poll GET /api/wearables until it changes. */
  lastSyncAt: string | null;
}

export interface SessionSyncResult {
  providers: SessionSyncEntry[];
  /** True if at least one new job was queued by this call. */
  queued: boolean;
}

export async function requestSessionSync(userId: string, now: Date = new Date()): Promise<SessionSyncResult> {
  const connections = await listConnectionsForUser(userId);
  const providers: SessionSyncEntry[] = [];
  let queued = false;

  for (const connection of connections) {
    const lastSyncAt = connection.lastSyncAt ? new Date(connection.lastSyncAt) : null;
    const base = { provider: connection.provider, lastSyncAt: lastSyncAt ? lastSyncAt.toISOString() : null };

    if (connection.status === 'AUTH_REQUIRED' || connection.status === 'ERROR') {
      providers.push({ ...base, status: 'reconnect_required' });
      continue;
    }
    if (connection.status !== 'CONNECTED' || !connection.id) continue;

    if (!isSupportedWearableProvider(connection.provider)) {
      // Pushed by the device itself (Apple Health).
      providers.push({ ...base, status: 'device_push' });
      continue;
    }

    try {
      const active = await findActiveSyncJobForConnection(
        connection.id,
        new Date(now.getTime() - SESSION_SYNC_IN_FLIGHT_WINDOW_MS),
      );
      if (active) {
        providers.push({ ...base, status: 'in_progress', jobId: active.id });
        continue;
      }

      if (lastSyncAt && now.getTime() - lastSyncAt.getTime() < SESSION_SYNC_STALE_AFTER_MS) {
        providers.push({ ...base, status: 'fresh' });
        continue;
      }

      const job = await enqueueManualSyncJob({
        userId,
        connectionId: connection.id,
        provider: connection.provider,
      });
      try {
        await enqueueSyncJobToQueue('MANUAL', job.id);
      } catch (error) {
        // The row exists but never reached the queue (Redis down...). Close it
        // so it does not read as "in flight" and block the next attempt.
        await completeSyncJob(job.id, {
          status: 'FAILED',
          recordsFetched: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          datesUpserted: 0,
          workoutsUpserted: 0,
          errorCode: 'ENQUEUE_FAILED',
          errorMessage: (error as Error).message,
        });
        throw error;
      }
      queued = true;
      providers.push({ ...base, status: 'queued', jobId: job.id });
    } catch (error) {
      logger.warn('session_sync_failed', { provider: connection.provider, error: (error as Error).message });
      providers.push({ ...base, status: 'error' });
    }
  }

  return { providers, queued };
}
