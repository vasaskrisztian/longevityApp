import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { listMyFollowing } from '@/modules/creators/creators.service';

/**
 * Phase 20 (mobile): the web app's Discover page
 * (src/app/profile/discover/page.tsx) is a server component that calls
 * listMyFollowing(user.id) directly — there was never a Route Handler for
 * it because nothing client-side needed one until mobile. This is a thin
 * wrapper with no new logic, same shape as every other GET-list route in
 * this module (/api/protocols, /api/challenges, /api/goals, ...).
 */
export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const following = await listMyFollowing(userId);
  return Response.json(following, { status: 200 });
}
