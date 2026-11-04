import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { CompleteVideoWatchSchema } from '@/lib/validation/group.schemas';
import { completeVideoWatch } from '@/modules/groups/group-challenges.service';
import { groupChallengeErrorResponse } from '@/modules/groups/group-challenge-http';

type RouteParams = { params: { groupId: string; challengeId: string } };

/**
 * A participant reports that the video was watched to the end. Counts as one
 * session for the person's own day — only if the viewing was started here, the
 * real time since then and the reported playing time both cover the video.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  const body = await request.json().catch(() => null);
  const parsed = CompleteVideoWatchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await completeVideoWatch(userId, params.groupId, params.challengeId, parsed.data);
    return Response.json(result, { status: 200 });
  } catch (error) {
    const response = groupChallengeErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
