import { Worker, type Job } from 'bullmq';
import { getRedisConnection } from '@/lib/queue/connection';
import { computeBackoffDelayMs } from '@/modules/wearable/services/sync-retry-policy';
import { runQueuedSyncJob } from '@/modules/wearable/services/sync-job-runner.service';
import type { WearableProviderAdapter } from '@/modules/wearable/domain/wearable-provider.types';

/**
 * Provider-agnostic: takes a `WearableProviderAdapter`, never imports
 * anything Oura-specific itself (mirrors `sync.service.ts`/
 * `normalization.service.ts` from Phase 5 — only the three `oura-*-sync
 * .job.ts` files below know Oura exists, by supplying the concrete
 * adapter). This is the piece every BullMQ `Worker` actually runs; it is
 * intentionally a thin adapter over `runQueuedSyncJob` (the fully unit-
 * tested orchestration) rather than duplicating any of that logic here —
 * only the `Job`-shaped input/rethrow boundary lives in this file.
 *
 * A minimal `{ data: { jobId }, attemptsMade }` shape is accepted rather
 * than the full BullMQ `Job` type, so this function — the part that
 * actually matters for correctness — is unit-tested with a plain object,
 * no `bullmq` mock required.
 */
export function createSyncQueueProcessor(adapter: WearableProviderAdapter) {
  return async function processSyncJob(job: { data: { jobId: string }; attemptsMade: number }) {
    // runQueuedSyncJob throws RetryableSyncJobError for a transient
    // failure; rethrowing here is what tells BullMQ to schedule a retry
    // per the backoff strategy below. A non-retryable outcome (SUCCESS,
    // PARTIAL, or FAILED/AUTH_REQUIRED) resolves normally.
    return runQueuedSyncJob({ jobId: job.data.jobId, adapter, attemptsMade: job.attemptsMade });
  };
}

/**
 * Thin BullMQ wiring shared by all three `oura-*-sync.job.ts` workers
 * (identical besides the queue name and which adapter they're given) —
 * kept here rather than duplicated three times, while ARCHITECTURE.md §2's
 * repository layout still gets its one-file-per-SyncJobType worker entry
 * points.
 */
export function startSyncWorker(queueName: string, adapter: WearableProviderAdapter): Worker {
  return new Worker(queueName, createSyncQueueProcessor(adapter) as (job: Job) => Promise<unknown>, {
    connection: getRedisConnection(),
    settings: { backoffStrategy: computeBackoffDelayMs },
  });
}
