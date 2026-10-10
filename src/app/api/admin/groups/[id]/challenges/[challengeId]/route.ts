import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { deleteGroupChallenge, getGroupChallengeDetailForAdmin } from '@/modules/groups/group-challenges.service';

type RouteParams = { params: { id: string; challengeId: string } };

/** Who joined, how far each person is, the team's standing and who has not joined. */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
  } catch (error) {
    return toErrorResponse(error);
  }
  const detail = await getGroupChallengeDetailForAdmin(params.id, params.challengeId);
  if (!detail) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(detail, { status: 200 });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  const deleted = await deleteGroupChallenge(adminId, params.id, params.challengeId);
  if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 });
  return new Response(null, { status: 204 });
}
