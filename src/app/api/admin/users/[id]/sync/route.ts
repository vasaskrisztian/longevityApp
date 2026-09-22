import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { checkRateLimit, MANUAL_SYNC_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { getConnectionForUserAndProvider } from '@/modules/wearable/services/wearable.service';
import { enqueueManualSyncJob } from '@/modules/wearable/services/sync-job.service';
import { enqueueSyncJobToQueue } from '@/lib/queue/queues';
import { userExistsForAdmin, recordAdminTriggerSync } from '@/modules/admin/admin.service';

interface RouteParams {
  params: { id: string };
}

/**
 * ARCHITECTURE.md §8.2: "Trigger a manual sync for a user" -> `ADMIN_TRIGGER_SYNC`.
 * Reuses Phase 7's `enqueueManualSyncJob`/`enqueueSyncJobToQueue` pair
 * unchanged — an admin-triggered sync is the same `MANUAL` `SyncJob` a
 * user's own "sync now" click creates, just enqueued on their behalf. The
 * rate limit is deliberately keyed by the TARGET user's id, not the
 * admin's: it's the same Oura connection either way, so an admin clicking
 * "sync now" for a user shares that user's own 1-per-5-minutes budget
 * rather than getting a separate one — the limit exists to protect Oura's
 * API from being hammered for one connection, not to throttle admins.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  if (!(await userExistsForAdmin(params.id))) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const rateLimit = checkRateLimit('manual-sync', params.id, MANUAL_SYNC_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'A sync was already triggered for this user in the last 5 minutes.' },
      { status: 429 },
    );
  }

  const connection = await getConnectionForUserAndProvider(params.id, 'OURA');
  if (connection.status !== 'CONNECTED' || !connection.id) {
    return Response.json({ error: 'This user has no connected Oura account to sync.' }, { status: 409 });
  }

  const job = await enqueueManualSyncJob({
    userId: params.id,
    connectionId: connection.id,
    provider: 'OURA',
  });
  await enqueueSyncJobToQueue('MANUAL', job.id);
  await recordAdminTriggerSync(adminId, params.id, job.id);

  return Response.json({ jobId: job.id }, { status: 202 });
}
