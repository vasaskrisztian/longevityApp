import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { removeMemberAsAdmin } from '@/modules/groups/groups.service';

/** Removes a member from the group (ends the administrators' access to their data). */
export async function DELETE(_request: Request, { params }: { params: { id: string; userId: string } }) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  const removed = await removeMemberAsAdmin(adminId, params.id, params.userId);
  if (!removed) return Response.json({ error: 'Not found' }, { status: 404 });
  return new Response(null, { status: 204 });
}
