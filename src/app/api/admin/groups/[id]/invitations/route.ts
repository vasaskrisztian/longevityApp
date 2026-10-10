import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { InviteMembersSchema } from '@/lib/validation/group.schemas';
import { inviteMembers } from '@/modules/groups/invitations.service';

interface RouteParams {
  params: { id: string };
}

/**
 * Sends (or re-sends) invitation emails. `emails` may be an array or one
 * pasted string; the response says per address whether an invitation went
 * out or the person is already a member.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = InviteMembersSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const results = await inviteMembers({ adminId, groupId: params.id, emails: parsed.data.emails });
  if (!results) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ results }, { status: 200 });
}
