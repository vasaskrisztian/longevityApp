import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { listMyGroups } from '@/modules/groups/groups.service';
import { listMyPendingInvitations } from '@/modules/groups/invitations.service';

/** The signed-in user's wellbeing overview: groups they belong to + invitations waiting for them. */
export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  const [groups, pendingInvitations] = await Promise.all([listMyGroups(userId), listMyPendingInvitations(userId)]);
  return Response.json({ groups, pendingInvitations }, { status: 200 });
}
