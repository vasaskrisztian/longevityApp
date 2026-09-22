import { prisma } from '@/lib/db/prisma';
import { computeSyncWindow } from './sync-window.service';
import { isRetryableSyncFailure } from './sync-retry-policy';
import { markSyncJobRunning, completeSyncJob } from './sync-job.service';
import { runSyncForConnection, type SyncResult } from './sync.service';
import type { WearableProviderAdapter } from '../domain/wearable-provider.types';

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

  const result = await runSyncForConnection({
    userId: job.userId,
    connectionId: job.connectionId,
    provider: job.provider,
    adapter,
    from,
    to,
  });

  await completeSyncJob(jobId, result, attemptsMade);

  if (isRetryableSyncFailure({ status: result.status, errorCode: result.errorCode })) {
    throw new RetryableSyncJobError(jobId, result);
  }

  return result;
}
