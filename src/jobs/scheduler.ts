import { Worker } from 'bullmq';
import { getRedisConnection } from '@/lib/queue/connection';
import { getQueue, enqueueSyncJobToQueue, DAILY_SCAN_QUEUE_NAME } from '@/lib/queue/queues';
import { enqueueDailySyncJobsForActiveConnections } from '@/modules/wearable/services/sync-job.service';

/**
 * ARCHITECTURE.md §7.2: "A scheduler ... runs at least once a day: query all
 * WearableConnection rows with status = CONNECTED, enqueue one DAILY
 * SyncJob per connection. A browser request never triggers this — it is
 * purely server-scheduled." This is that scan: create the bookkeeping
 * SyncJob rows (sync-job.service.ts, already fully unit-tested against a
 * mocked Prisma client) and push each one onto the real DAILY queue so a
 * worker actually picks it up.
 */
export async function runDailySyncScan(): Promise<{ enqueued: number }> {
  const jobs = await enqueueDailySyncJobsForActiveConnections();
  for (const job of jobs) {
    await enqueueSyncJobToQueue('DAILY', job.id);
  }
  return { enqueued: jobs.length };
}

/** 03:00 UTC daily — off-peak, comfortably before most users start their day. */
const DAILY_SCAN_CRON = '0 3 * * *';
const DAILY_SCAN_SCHEDULER_ID = 'daily-sync-scan';

/**
 * Registers the repeatable trigger exactly once (idempotent — BullMQ's
 * `upsertJobScheduler` replaces any existing scheduler with this id rather
 * than creating a duplicate on every process restart).
 */
export async function scheduleDailySyncScan(): Promise<void> {
  const queue = getQueue(DAILY_SCAN_QUEUE_NAME);
  await queue.upsertJobScheduler(DAILY_SCAN_SCHEDULER_ID, { pattern: DAILY_SCAN_CRON }, { name: 'daily-scan' });
}

/** The worker that actually runs the scan when the scheduled trigger fires. */
export function startDailySyncScanWorker(): Worker {
  return new Worker(DAILY_SCAN_QUEUE_NAME, () => runDailySyncScan(), {
    connection: getRedisConnection(),
  });
}
