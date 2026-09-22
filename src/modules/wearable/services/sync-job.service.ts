import { prisma } from '@/lib/db/prisma';
import type { WearableProviderId } from '../domain/wearable-provider.types';
import type { SyncResult } from './sync.service';

/**
 * All `SyncJob` row bookkeeping lives here — creating rows (INITIAL/DAILY/
 * MANUAL) and recording their lifecycle transitions (QUEUED -> RUNNING ->
 * SUCCESS/PARTIAL/FAILED, per ARCHITECTURE.md §7.4's flow diagram). This
 * file never touches a queue itself — `lib/queue/queues.ts` does the actual
 * Redis/BullMQ push; keeping the split means every function here is testable
 * against a mocked Prisma client alone, exactly like every other service in
 * this module.
 */

export async function enqueueInitialSyncJob(params: {
  userId: string;
  connectionId: string;
  provider: WearableProviderId;
}): Promise<{ id: string }> {
  const job = await prisma.syncJob.create({
    data: {
      userId: params.userId,
      connectionId: params.connectionId,
      provider: params.provider,
      type: 'INITIAL',
      status: 'QUEUED',
    },
  });
  return { id: job.id };
}

export async function enqueueManualSyncJob(params: {
  userId: string;
  connectionId: string;
  provider: WearableProviderId;
}): Promise<{ id: string }> {
  const job = await prisma.syncJob.create({
    data: {
      userId: params.userId,
      connectionId: params.connectionId,
      provider: params.provider,
      type: 'MANUAL',
      status: 'QUEUED',
    },
  });
  return { id: job.id };
}

/**
 * ARCHITECTURE.md §7.2: "query all WearableConnection rows with
 * status = CONNECTED, enqueue one DAILY SyncJob per connection." This only
 * creates the bookkeeping rows (bulk, sequentially — daily-scan volume is
 * low, one row per active connection, so no batching is needed); the
 * caller (`jobs/scheduler.ts`) is responsible for pushing each returned id
 * onto the actual queue. Splitting it this way keeps this function testable
 * with a mocked Prisma client alone, with no BullMQ/Redis involved.
 */
export async function enqueueDailySyncJobsForActiveConnections(): Promise<
  { id: string; userId: string; connectionId: string; provider: WearableProviderId }[]
> {
  const connections = await prisma.wearableConnection.findMany({
    where: { status: 'CONNECTED' },
    select: { id: true, userId: true, provider: true },
  });

  const created: { id: string; userId: string; connectionId: string; provider: WearableProviderId }[] =
    [];
  for (const connection of connections) {
    const job = await prisma.syncJob.create({
      data: {
        userId: connection.userId,
        connectionId: connection.id,
        provider: connection.provider,
        type: 'DAILY',
        status: 'QUEUED',
      },
    });
    created.push({
      id: job.id,
      userId: connection.userId,
      connectionId: connection.id,
      provider: connection.provider,
    });
  }
  return created;
}

/** Marks a job RUNNING and stamps startedAt — called once per attempt, including retries. */
export async function markSyncJobRunning(jobId: string): Promise<void> {
  await prisma.syncJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });
}

/**
 * Writes a `SyncResult` (sync.service.ts's return value) back onto the
 * `SyncJob` row — the exact step Phase 5's summary flagged as "Phase 7's
 * worker will persist onto a SyncJob row without touching sync.service.ts's
 * code." `retryCount` is BullMQ's `job.attemptsMade` at settle time (0 on a
 * first-try success, N after N prior failed attempts) — the caller supplies
 * it rather than this function incrementing anything itself, since BullMQ is
 * the single source of truth for how many attempts a job has actually made.
 */
export async function completeSyncJob(
  jobId: string,
  result: SyncResult,
  retryCount = 0,
): Promise<void> {
  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: result.status,
      finishedAt: new Date(),
      recordsFetched: result.recordsFetched,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      retryCount,
      errorCode: result.errorCode ?? null,
      errorMessage: result.errorMessage ?? null,
    },
  });
}
