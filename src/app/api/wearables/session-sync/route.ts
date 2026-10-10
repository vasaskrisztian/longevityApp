import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { checkRateLimit, SESSION_SYNC_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { requestSessionSync } from '@/modules/wearable/services/session-sync.service';

/**
 * POST /api/wearables/session-sync — "the user just opened the app / site":
 * queues a sync for every connected server-pulled device whose data is stale
 * and tells device-pushed ones (Apple Health) to push. Returns immediately
 * (the Oura round-trip happens in the worker); clients then poll
 * GET /api/wearables until a provider's `lastSyncAt` moves. Works with the
 * NextAuth cookie (web) and the Bearer token (mobile) alike.
 */
export async function POST() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const rateLimit = checkRateLimit('session-sync', userId, SESSION_SYNC_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Too many sync checks. Please try again shortly.' }, { status: 429 });
  }

  const result = await requestSessionSync(userId);
  return Response.json(result, { status: 200 });
}
