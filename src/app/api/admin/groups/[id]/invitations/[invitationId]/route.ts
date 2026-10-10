import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { revokeInvitation } from '@/modules/groups/invitations.service';

/** Cancels a pending invitation — its link stops working. */
export async function DELETE(_request: Request, { params }: { params: { id: string; invitationId: string } }) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  const revoked = await revokeInvitation(adminId, params.id, params.invitationId);
  if (!revoked) return Response.json({ error: 'Not found' }, { status: 404 });
  return new Response(null, { status: 204 });
}
