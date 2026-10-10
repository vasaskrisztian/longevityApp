import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { CreateGroupChallengeSchema } from '@/lib/validation/group.schemas';
import {
  createGroupChallenge,
  finalizeEndedGroupChallenges,
  GroupChallengeError,
  listGroupChallengesForAdmin,
} from '@/modules/groups/group-challenges.service';
import { logger } from '@/lib/logging/logger';

interface RouteParams {
  params: { id: string };
}

/** The group's challenges with the team aggregate. Also sends any overdue end-of-challenge summaries. */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
  } catch (error) {
    return toErrorResponse(error);
  }
  await finalizeEndedGroupChallenges().catch((error: Error) =>
    logger.error('group_challenge_lazy_finalize_failed', { message: error.message }),
  );
  return Response.json({ challenges: await listGroupChallengesForAdmin(params.id) }, { status: 200 });
}

/** Creates a challenge and notifies every current member in-app. */
export async function POST(request: Request, { params }: RouteParams) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateGroupChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const challenge = await createGroupChallenge(adminId, params.id, parsed.data);
    if (!challenge) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(challenge, { status: 201 });
  } catch (error) {
    if (error instanceof GroupChallengeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
