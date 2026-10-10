import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { AcceptInvitationSchema } from '@/lib/validation/group.schemas';
import { acceptInvitation } from '@/modules/groups/invitations.service';
import { invitationErrorResponse } from '@/modules/groups/invitation-http';

/** Accepts one of the caller's own pending invitations by id (from a notification or the wellbeing page). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = AcceptInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return Response.json(await acceptInvitation({ userId, invitationId: params.id }), { status: 200 });
  } catch (error) {
    const response = invitationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
