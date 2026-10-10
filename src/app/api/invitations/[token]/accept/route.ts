import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { AcceptInvitationSchema } from '@/lib/validation/group.schemas';
import { acceptInvitation } from '@/modules/groups/invitations.service';
import { invitationErrorResponse } from '@/modules/groups/invitation-http';

/** A signed-in user accepts the invitation sent to their own address, consenting to share health data with the group's administrators. */
export async function POST(request: Request, { params }: { params: { token: string } }) {
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
    return Response.json(await acceptInvitation({ userId, rawToken: params.token }), { status: 200 });
  } catch (error) {
    const response = invitationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
