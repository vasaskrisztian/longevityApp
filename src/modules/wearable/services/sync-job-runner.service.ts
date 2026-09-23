import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logging/logger';
import { computeSyncWindow } from './sync-window.service';
import { isRetryableSyncFailure } from './sync-retry-policy';
import { markSyncJobRunning, completeSyncJob, completeSyncJobIfStillRunning } from './sync-job.service';
import { runSyncForConnection, type SyncResult } from './sync.service';
import type { WearableProviderAdapter } from '../domain/wearable-provider.types';

/**
 * A whole sync attempt — token refresh, all six Oura endpoints, and the DB
 * writes — bounded from above, on top of the per-HTTP-request timeouts
 * already inside `runSyncForConnection`'s own dependencies. Those per-request
 * timeouts (oura-api-client.ts, oura-auth.ts) turned out not to be enough on
 * their own: a real INITIAL and a real MANUAL sync attempt were both
 * observed stuck in RUNNING for 10+ minutes in production even after that
 * fix shipped, permanently wedging their queue's single concurrency slot
 * (nothing else of that job type can ever run behind a job stuck like this).
 * Whatever the exact stuck `await` turns out to be, this is the backstop:
 * no single attempt can wedge a queue forever again. Generous relative to
 * the 20s-per-request timeouts (6 endpoints, sequential pagination on the
 * heaviest one) but still far short of "forever".
 */
export const SYNC_JOB_HARD_TIMEOUT_MS = 4 * 60 * 1000;

export class SyncJobHardTimeoutError extends Error {
  constructor(jobId: string, timeoutMs: number) {
    super(`Sync job ${jobId} exceeded the ${timeoutMs}ms hard timeout`);
    this.name = 'SyncJobHardTimeoutError';
  }
}

/**
 * Races `promise` against a timer. There is no way to truly cancel
 * `promise` itself (it has no AbortSignal wired all the way through) — this
 * only stops *waiting* on it; see `completeSyncJobIfStillRunning`'s doc for
 * how the eventual, abandoned settlement is handled safely.
 */
function withHardTimeout<T>(promise: Promise<T>, jobId: string, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new SyncJobHardTimeoutError(jobId, timeoutMs)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Thrown when a sync attempt fails in a way worth retrying (a transient
 * fetch failure — see sync-retry-policy.ts). `jobs/wearable-sync.job.ts`
 * rethrows/propagates this so BullMQ's own retry+backoff mechanism picks it
 * up; a non-retryable failure (AUTH_REQUIRED) or a PARTIAL/SUCCESS result
 * resolves normally instead, since there is nothing a retry would fix.
 */
export class RetryableSyncJobError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly result: SyncResult,
  ) {
    super(`Sync job ${jobId} failed with a retryable error: ${result.errorMessage ?? result.errorCode}`);
    this.name = 'RetryableSyncJobError';
  }
}

/** Thrown when the SyncJob row referenced by a queued job no longer exists — nothing to run. */
export class SyncJobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`SyncJob ${jobId} not found`);
    this.name = 'SyncJobNotFoundError';
  }
}

/**
 * The single function every queue worker calls (ARCHITECTURE.md §7.4's
 * "Worker picks up job" step, previously a seam with no caller per Phase
 * 5's summary). Loads the `SyncJob` + its connection, computes the
 * incremental/initial window (§7.3), runs Phase 5's `runSyncForConnection`,
 * and writes the outcome back onto the job row — all in one place so no
 * queue-wiring file needs to know any of this orchestration itself.
 */
export async function runQueuedSyncJob(params: {
  jobId: string;
  adapter: WearableProviderAdapter;
  attemptsMade?: number;
}): Promise<SyncResult> {
  const { jobId, adapter, attemptsMade = 0 } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job: any = await prisma.syncJob.findUnique({
    where: { id: jobId },
    include: { connection: true },
  });
  if (!job) {
    throw new SyncJobNotFoundError(jobId);
  }

  const { from, to } = computeSyncWindow({
    type: job.type,
    lastSuccessfulSyncAt: job.connection?.lastSuccessfulSyncAt ?? null,
    now: new Date(),
  });

  await markSyncJobRunning(jobId);
  logger.info('sync_job_started', {
    jobId,
    connectionId: job.connectionId,
    provider: job.provider,
    type: job.type,
    attemptsMade,
    from: from.toISOString(),
    to: to.toISOString(),
  });

  const attempt = runSyncForConnection({
    userId: job.userId,
    connectionId: job.connectionId,
    provider: job.provider,
    adapter,
    from,
    to,
  });

  let result: SyncResult;
  let hitHardTimeout = false;
  try {
    result = await withHardTimeout(attempt, jobId, SYNC_JOB_HARD_TIMEOUT_MS);
  } catch (error) {
    if (!(error instanceof SyncJobHardTimeoutError)) {
      throw error;
    }
    hitHardTimeout = true;
    logger.error('sync_job_hard_timeout', {
      jobId,
      connectionId: job.connectionId,
      timeoutMs: SYNC_JOB_HARD_TIMEOUT_MS,
    });
    result = {
      status: 'FAILED',
      recordsFetched: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      datesUpserted: 0,
      workoutsUpserted: 0,
      errorCode: 'FETCH_FAILED',
      errorMessage: `Sync exceeded the ${SYNC_JOB_HARD_TIMEOUT_MS}ms hard timeout — check sync_job_stage logs around ${new Date().toISOString()} for the last stage reached`,
    };
    // The abandoned attempt has no cancellation hook, so it keeps running in
    // the background; log how it eventually settles (for diagnosis) without
    // ever writing it back onto the job row — a retry (or another future
    // attempt) may already own that row's RUNNING state by the time this
    // resolves, and completeSyncJobIfStillRunning's guard exists precisely
    // so this stray settlement can't clobber it.
    attempt.then(
      (lateResult) => {
        logger.warn('sync_job_late_settlement_after_hard_timeout', {
          jobId,
          status: lateResult.status,
          recordsFetched: lateResult.recordsFetched,
        });
      },
      (lateError: unknown) => {
        logger.warn('sync_job_late_settlement_after_hard_timeout', {
          jobId,
          error: lateError instanceof Error ? lateError.message : String(lateError),
        });
      },
    );
  }

  if (hitHardTimeout) {
    await completeSyncJobIfStillRunning(jobId, result, attemptsMade);
  } else {
    await completeSyncJob(jobId, result, attemptsMade);
  }
  logger.info('sync_job_finished', {
    jobId,
    status: result.status,
    recordsFetched: result.recordsFetched,
    hitHardTimeout,
  });

  if (isRetryableSyncFailure({ status: result.status, errorCode: result.errorCode })) {
    throw new RetryableSyncJobError(jobId, result);
  }

  return result;
}
