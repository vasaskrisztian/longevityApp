import { logger } from '@/lib/logging/logger';
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
  // Stage markers only — see sync-job-runner.service.ts's hard-timeout
  // comment. There was previously almost no visibility into where a sync
  // attempt actually spends its time, which made a stuck job indistinguishable
  // from a slow one; these events (plus oura-api-client.ts's per-page ones and
  // oura-auth.ts's token-request ones) are what the next hang gets diagnosed from.
  const stageStart = Date.now();
  logger.info('sync_job_stage', { connectionId: params.connectionId, stage: 'ensure_fresh_token_start' });

  let accessToken: string;
  try {
    const fresh = await ensureFreshAccessToken(params.connectionId, params.adapter);
    accessToken = fresh.accessToken;
    logger.info('sync_job_stage', {
      connectionId: params.connectionId,
      stage: 'ensure_fresh_token_done',
      elapsedMs: Date.now() - stageStart,
    });
  } catch (error) {
    // ensureFreshAccessToken already marks the connection AUTH_REQUIRED on a
    // rejected refresh (ARCHITECTURE.md §6.2, guarantee #3); recordSyncOutcome
    // separately tracks lastSyncAt/lastSyncStatus, which markConnectionAuthRequired
    // does not touch.
    logger.warn('sync_job_stage', {
      connectionId: params.connectionId,
      stage: 'ensure_fresh_token_failed',
      elapsedMs: Date.now() - stageStart,
      error: (error as Error).message,
    });
    await recordSyncOutcome(params.connectionId, 'FAILED');
    return emptyResult('FAILED', 'AUTH_REQUIRED', (error as Error).message);
  }

  const fetchStart = Date.now();
  logger.info('sync_job_stage', { connectionId: params.connectionId, stage: 'fetch_raw_data_start' });
  const { records, failures } = await params.adapter.fetchRawData({
    accessToken,
    from: params.from,
    to: params.to,
  });
  logger.info('sync_job_stage', {
    connectionId: params.connectionId,
    stage: 'fetch_raw_data_done',
    elapsedMs: Date.now() - fetchStart,
    recordCount: records.length,
    failureCount: failures.length,
  });

  if (records.length === 0 && failures.length > 0) {
    await recordSyncOutcome(params.connectionId, 'FAILED');
    return emptyResult(
      'FAILED',
      'FETCH_FAILED',
      failures.map((failure) => `${failure.dataType}: ${failure.message}`).join('; '),
    );
  }

  const writeStart = Date.now();
  logger.info('sync_job_stage', { connectionId: params.connectionId, stage: 'db_write_start' });
  // These three writes run one after another, not via Promise.all. Running
  // them concurrently was found in production to hang forever with
  // @prisma/adapter-pg: pg_stat_activity showed every connection sitting
  // `idle` with `wait_event: ClientRead` -- Postgres had already answered,
  // but the response never made it back out of the engine/adapter bridge to
  // Node. It reproduced reliably with concurrent Prisma calls and never with
  // sequential ones (see raw-record.service.ts for the fuller writeup).
  // Until that's fixed upstream, nothing in this write path issues more
  // than one Prisma query at a time.
  // Three checkpoints between the three writes below (in addition to
  // db_write_start/db_write_done bracketing all of them) — added after a
  // live sync completed storeRawRecords cleanly (proven fast and reliable
  // on its own) and then still sat frozen with zero further progress and
  // zero rows in pg_stat_activity. db_write_start/db_write_done alone
  // can't say which of the three calls that freeze was in; these can.
  const { created, updated } = await storeRawRecords({
    userId: params.userId,
    connectionId: params.connectionId,
    provider: params.provider,
    records,
  });
  logger.info('sync_job_stage', {
    connectionId: params.connectionId,
    stage: 'store_raw_records_done',
    elapsedMs: Date.now() - writeStart,
  });
  const { datesUpserted } = await normalizeAndUpsertDailyMetrics({
    userId: params.userId,
    provider: params.provider,
    records,
    adapter: params.adapter,
  });
  logger.info('sync_job_stage', {
    connectionId: params.connectionId,
    stage: 'normalize_daily_metrics_done',
    elapsedMs: Date.now() - writeStart,
  });
  const { workoutsUpserted } = await normalizeAndUpsertWorkouts({
    userId: params.userId,
    provider: params.provider,
    records,
    adapter: params.adapter,
  });
  logger.info('sync_job_stage', {
    connectionId: params.connectionId,
    stage: 'db_write_done',
    elapsedMs: Date.now() - writeStart,
  });

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
