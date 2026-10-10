import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { removeMembership } from '@/modules/groups/groups.service';

/** Leave a group: ends the administrators' access to the caller's data and removes them from the group's challenges. */
export async function DELETE(_request: Request, { params }: { params: { groupId: string } }) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  const removed = await removeMembership(params.groupId, userId);
  if (!removed) return Response.json({ error: 'Not found' }, { status: 404 });
  return new Response(null, { status: 204 });
}
