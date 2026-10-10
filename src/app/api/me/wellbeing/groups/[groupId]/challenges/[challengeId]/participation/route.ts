import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { joinGroupChallenge, leaveGroupChallenge } from '@/modules/groups/group-challenges.service';
import { groupChallengeErrorResponse } from '@/modules/groups/group-challenge-http';

type RouteParams = { params: { groupId: string; challengeId: string } };

/** Voluntarily join a group challenge (members only, not after it ended). */
export async function POST(_request: Request, { params }: RouteParams) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  try {
    await joinGroupChallenge(userId, params.groupId, params.challengeId);
    return Response.json({ joined: true }, { status: 200 });
  } catch (error) {
    const response = groupChallengeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  try {
    await leaveGroupChallenge(userId, params.groupId, params.challengeId);
    return new Response(null, { status: 204 });
  } catch (error) {
    const response = groupChallengeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
