import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { listNotifications } from '@/modules/notifications/notifications.service';
import { finalizeEndedGroupChallenges } from '@/modules/groups/group-challenges.service';
import { logger } from '@/lib/logging/logger';

/**
 * The signed-in user's in-app notifications (newest first) plus the unread
 * count that drives the bell badge. Doubles as the lazy trigger for overdue
 * end-of-challenge summaries, so they appear even if the worker is down.
 */
export async function GET(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  await finalizeEndedGroupChallenges().catch((error: Error) =>
    logger.error('group_challenge_lazy_finalize_failed', { message: error.message }),
  );

  const limit = Number(new URL(request.url).searchParams.get('limit'));
  return Response.json(await listNotifications(userId, Number.isFinite(limit) && limit > 0 ? limit : 30), { status: 200 });
}
