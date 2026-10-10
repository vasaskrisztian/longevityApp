import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { finalizeEndedGroupChallenges, listMyGroupChallenges } from '@/modules/groups/group-challenges.service';
import { groupChallengeErrorResponse } from '@/modules/groups/group-challenge-http';
import { logger } from '@/lib/logging/logger';

/** The group's challenges as the member sees them: own status + the team aggregate (never other people's data). */
export async function GET(_request: Request, { params }: { params: { groupId: string } }) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  await finalizeEndedGroupChallenges().catch((error: Error) =>
    logger.error('group_challenge_lazy_finalize_failed', { message: error.message }),
  );
  try {
    return Response.json({ challenges: await listMyGroupChallenges(userId, params.groupId) }, { status: 200 });
  } catch (error) {
    const response = groupChallengeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
