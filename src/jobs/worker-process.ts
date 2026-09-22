import { pathToFileURL } from 'node:url';
import { startOuraInitialSyncWorker } from './oura-initial-sync.job';
import { startOuraDailySyncWorker } from './oura-daily-sync.job';
import { startOuraManualSyncWorker } from './oura-manual-sync.job';
import { startDailySyncScanWorker, scheduleDailySyncScan } from './scheduler';
import { logger } from '@/lib/logging/logger';

/**
 * The standalone worker process ARCHITECTURE.md §1.4 calls for ("one
 * deployable Next.js app + one worker process, sharing the Prisma client
 * and service layer"). Run with `npm run worker` — never imported by the
 * Next.js app itself, so `next build`/`next dev` never construct a Worker
 * or open a Redis connection just by loading route modules that import
 * from `lib/queue/*` (those only build lazy Queue *producers*, not
 * consumers — see connection.ts's `lazyConnect: true`).
 *
 * Nothing here can be exercised live in this sandbox (no reachable Redis —
 * the same category of limitation as `prisma generate` being blocked; see
 * docs/phase-7-summary.md's Known limitations), so this file is
 * deliberately as thin as possible: every branch of actual logic (window
 * computation, retry classification, job bookkeeping) lives in the
 * fully-unit-tested modules this just wires together.
 */
export async function startWorkerProcess(): Promise<void> {
  startOuraInitialSyncWorker();
  startOuraDailySyncWorker();
  startOuraManualSyncWorker();
  startDailySyncScanWorker();
  await scheduleDailySyncScan();
  logger.info('worker_process_started', {
    queues: ['oura-initial-sync', 'oura-daily-sync', 'oura-manual-sync', 'oura-daily-sync-scan'].join(
      ', ',
    ),
  });
}

const isMainModule =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  startWorkerProcess().catch((error) => {
    logger.error('worker_process_failed_to_start', { message: (error as Error).message });
    process.exitCode = 1;
  });
}
