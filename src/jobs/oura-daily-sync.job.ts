import type { Worker } from 'bullmq';
import { startSyncWorker } from './wearable-sync.job';
import { SYNC_QUEUE_NAMES } from '@/lib/queue/queues';
import { getOuraProvider } from '@/modules/wearable/providers/oura/oura-provider';

/** Worker entry point for `SyncJobType.DAILY` — the scheduled incremental sync (ARCHITECTURE.md §7.2/§7.3), enqueued by jobs/scheduler.ts. */
export function startOuraDailySyncWorker(): Worker {
  return startSyncWorker(SYNC_QUEUE_NAMES.DAILY, getOuraProvider());
}
