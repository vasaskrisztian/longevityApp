import type { Worker } from 'bullmq';
import { startSyncWorker } from './wearable-sync.job';
import { SYNC_QUEUE_NAMES } from '@/lib/queue/queues';
import { getOuraProvider } from '@/modules/wearable/providers/oura/oura-provider';

/** Worker entry point for `SyncJobType.INITIAL` — the 30-day historical import kicked off right after OAuth connect (ARCHITECTURE.md §7.1). */
export function startOuraInitialSyncWorker(): Worker {
  return startSyncWorker(SYNC_QUEUE_NAMES.INITIAL, getOuraProvider());
}
