import type { Worker } from 'bullmq';
import { startSyncWorker } from './wearable-sync.job';
import { SYNC_QUEUE_NAMES } from '@/lib/queue/queues';
import { getOuraProvider } from '@/modules/wearable/providers/oura/oura-provider';

/** Worker entry point for `SyncJobType.MANUAL` — a user-triggered "sync now" (ARCHITECTURE.md §7.5), enqueued by app/api/integrations/oura/sync/route.ts. */
export function startOuraManualSyncWorker(): Worker {
  return startSyncWorker(SYNC_QUEUE_NAMES.MANUAL, getOuraProvider());
}
