import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { checkRateLimit, MANUAL_SYNC_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { getConnectionForUserAndProvider } from '@/modules/wearable/services/wearable.service';
import { enqueueManualSyncJob } from '@/modules/wearable/services/sync-job.service';
import { enqueueSyncJobToQueue } from '@/lib/queue/queues';

/**
 * ARCHITECTURE.md §7.5: "POST /api/integrations/oura/sync only enqueues a
 * MANUAL SyncJob and returns immediately (202-style response) — it never
 * blocks on the Oura round-trip. Rate-limited to 1 manual sync per user per
 * 5 minutes, enforced server-side (not just a disabled button)." The rate
 * limit key is the authenticated user's own id, not their IP — this is a
 * per-user, per-account limit, unlike the IP-keyed auth-endpoint limits.
 */
export async function POST() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const rateLimit = checkRateLimit('manual-sync', userId, MANUAL_SYNC_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'You can only trigger a manual sync once every 5 minutes.' },
      { status: 429 },
    );
  }

  const connection = await getConnectionForUserAndProvider(userId, 'OURA');
  if (connection.status !== 'CONNECTED' || !connection.id) {
    return Response.json({ error: 'No connected Oura account to sync.' }, { status: 409 });
  }

  const job = await enqueueManualSyncJob({ userId, connectionId: connection.id, provider: 'OURA' });
  await enqueueSyncJobToQueue('MANUAL', job.id);

  return Response.json({ jobId: job.id }, { status: 202 });
}
