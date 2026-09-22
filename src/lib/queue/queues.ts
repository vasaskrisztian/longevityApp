import { Queue } from 'bullmq';
import type { SyncJobType } from '@prisma/client';
import { getRedisConnection } from './connection';
import { MAX_SYNC_JOB_ATTEMPTS } from '@/modules/wearable/services/sync-retry-policy';

/**
 * One queue per `SyncJobType`, per ARCHITECTURE.md §2's repository layout
 * (`jobs/oura-initial-sync.job.ts`, `oura-daily-sync.job.ts`,
 * `oura-manual-sync.job.ts`) — separate queues let INITIAL/DAILY/MANUAL
 * traffic be scaled, paused, or monitored independently (e.g. a burst of
 * INITIAL syncs from a marketing push should never starve daily syncs).
 * Every queue instance is created lazily, mirroring `getRedisConnection()` —
 * importing this module never opens a socket by itself.
 */
export const SYNC_QUEUE_NAMES = {
  INITIAL: 'oura-initial-sync',
  DAILY: 'oura-daily-sync',
  MANUAL: 'oura-manual-sync',
} as const satisfies Record<SyncJobType, string>;

/** The scheduler's own queue (see jobs/scheduler.ts) — distinct from the three above, which only ever carry one real connection's sync per job. */
export const DAILY_SCAN_QUEUE_NAME = 'oura-daily-sync-scan';

const queuesByName = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  let queue = queuesByName.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: getRedisConnection() });
    queuesByName.set(name, queue);
  }
  return queue;
}

/**
 * ARCHITECTURE.md §7.4: "429/5xx/timeout -> exponential backoff retry:
 * 1min, 5min, 30min", `MAX_SYNC_JOB_ATTEMPTS` total attempts. The label
 * `'sync-retry-schedule'` is just an identifier BullMQ forwards to the
 * custom `backoffStrategy` function each worker registers (see
 * `jobs/wearable-sync.job.ts`) — the actual delay values live in exactly
 * one place, `sync-retry-policy.ts`'s `computeBackoffDelayMs`.
 */
function syncJobOptions() {
  return {
    attempts: MAX_SYNC_JOB_ATTEMPTS,
    backoff: { type: 'sync-retry-schedule' },
    removeOnComplete: { age: 7 * 24 * 60 * 60 },
    removeOnFail: { age: 30 * 24 * 60 * 60 },
  };
}

/**
 * Pushes an already-created `SyncJob` row's id onto the right queue. This is
 * the second half of "enqueue" (the first half — `sync-job.service.ts`
 * writing the DB row — is separate on purpose, so every caller of the
 * DB-only functions stays testable against a mocked Prisma client with zero
 * Redis/BullMQ involved; only this function, and the handful of route/
 * scheduler call sites that use it, ever touch the real queue).
 */
export async function enqueueSyncJobToQueue(type: SyncJobType, jobId: string): Promise<void> {
  const queue = getQueue(SYNC_QUEUE_NAMES[type as keyof typeof SYNC_QUEUE_NAMES]);
  await queue.add('sync', { jobId }, syncJobOptions());
}

/** Test-only escape hatch, mirroring provider-registry.ts's `_resetRegistryForTests`. */
export function _resetQueuesForTests(): void {
  queuesByName.clear();
}
