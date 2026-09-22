import { ensureFreshAccessToken } from './refresh-credential.service';
import { storeRawRecords } from './raw-record.service';
import { normalizeAndUpsertDailyMetrics, normalizeAndUpsertWorkouts } from './normalization.service';
import { recordSyncOutcome } from './wearable.service';
import type { WearableProviderAdapter, WearableProviderId } from '../domain/wearable-provider.types';

/**
 * Ties Phase 5's ingestion pieces together into one callable unit: ensure a
 * fresh token (Phase 4), fetch raw data (this phase's API client/mock),
 * store it (this phase's raw-record service), normalize it (this phase's
 * mapper + normalization service), and record the outcome on the
 * connection. Deliberately NOT wired to any queue, scheduler, or `SyncJob`
 * row — that orchestration (QUEUED -> RUNNING -> SUCCESS/FAILED,
 * retries/backoff, `recordsFetched/Created/Updated` written onto the
 * `SyncJob` row itself, computing the incremental `syncFrom`/`syncTo`
 * window per §7.3) is explicitly Phase 7's scope per ARCHITECTURE.md §12's
 * phase table ("Background sync: queue, scheduler, retries, incremental
 * sync"). This function is what Phase 7's worker will call once it exists;
 * for now nothing invokes it in production, the same "seam without a
 * caller yet" state Phase 3's provider-registry and Phase 4's
 * `enqueueInitialSyncJob` were left in.
 */

export interface SyncResult {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  datesUpserted: number;
  workoutsUpserted: number;
  errorCode?: string;
  errorMessage?: string;
}

function emptyResult(status: 'FAILED', errorCode: string, errorMessage: string): SyncResult {
  return {
    status,
    recordsFetched: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    datesUpserted: 0,
    workoutsUpserted: 0,
    errorCode,
    errorMessage,
  };
}

export async function runSyncForConnection(params: {
  userId: string;
  connectionId: string;
  provider: WearableProviderId;
  adapter: WearableProviderAdapter;
  from: Date;
  to: Date;
}): Promise<SyncResult> {
  let accessToken: string;
  try {
    const fresh = await ensureFreshAccessToken(params.connectionId, params.adapter);
    accessToken = fresh.accessToken;
  } catch (error) {
    // ensureFreshAccessToken already marks the connection AUTH_REQUIRED on a
    // rejected refresh (ARCHITECTURE.md §6.2, guarantee #3); recordSyncOutcome
    // separately tracks lastSyncAt/lastSyncStatus, which markConnectionAuthRequired
    // does not touch.
    await recordSyncOutcome(params.connectionId, 'FAILED');
    return emptyResult('FAILED', 'AUTH_REQUIRED', (error as Error).message);
  }

  const { records, failures } = await params.adapter.fetchRawData({
    accessToken,
    from: params.from,
    to: params.to,
  });

  if (records.length === 0 && failures.length > 0) {
    await recordSyncOutcome(params.connectionId, 'FAILED');
    return emptyResult(
      'FAILED',
      'FETCH_FAILED',
      failures.map((failure) => `${failure.dataType}: ${failure.message}`).join('; '),
    );
  }

  const [{ created, updated }, { datesUpserted }, { workoutsUpserted }] = await Promise.all([
    storeRawRecords({
      userId: params.userId,
      connectionId: params.connectionId,
      provider: params.provider,
      records,
    }),
    normalizeAndUpsertDailyMetrics({
      userId: params.userId,
      provider: params.provider,
      records,
      adapter: params.adapter,
    }),
    normalizeAndUpsertWorkouts({
      userId: params.userId,
      provider: params.provider,
      records,
      adapter: params.adapter,
    }),
  ]);

  const status = failures.length > 0 ? 'PARTIAL' : 'SUCCESS';
  await recordSyncOutcome(params.connectionId, status);

  return {
    status,
    recordsFetched: records.length,
    recordsCreated: created,
    recordsUpdated: updated,
    datesUpserted,
    workoutsUpserted,
    errorCode: failures.length > 0 ? 'PARTIAL_FETCH_FAILURE' : undefined,
    errorMessage:
      failures.length > 0
        ? failures.map((failure) => `${failure.dataType}: ${failure.message}`).join('; ')
        : undefined,
  };
}
