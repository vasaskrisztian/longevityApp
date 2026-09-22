import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { getTodaySnapshot } from '@/modules/dashboard/dashboard.service';

/**
 * The dashboard "today" card. Always scoped to the caller's own id — never a
 * client-supplied userId — per the IDOR choke-point convention every other
 * user-scoped route in this codebase follows.
 */
export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const snapshot = await getTodaySnapshot(userId);
  return Response.json(snapshot, { status: 200 });
}
