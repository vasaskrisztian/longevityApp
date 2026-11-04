import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { startVideoWatch } from '@/modules/groups/group-challenges.service';
import { groupChallengeErrorResponse } from '@/modules/groups/group-challenge-http';

type RouteParams = { params: { groupId: string; challengeId: string } };

/** A participant starts watching the challenge's video; the returned `watchId` is needed to finish it. */
export async function POST(_request: Request, { params }: RouteParams) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  try {
    const watch = await startVideoWatch(userId, params.groupId, params.challengeId);
    return Response.json({ watchId: watch.watchId, startedAt: watch.startedAt.toISOString() }, { status: 201 });
  } catch (error) {
    const response = groupChallengeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
