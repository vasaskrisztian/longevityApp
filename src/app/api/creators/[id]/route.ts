import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { getCreatorPublicProfile } from '@/modules/creators/creators.service';

// Always-fresh data (follower count, published content) — never
// statically cached. See /api/creators/route.ts's comment.
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

/**
 * The FULL creator profile (public protocols, challenges, 90 days of health
 * metrics) — registered users only. Visitors without an account get the
 * stripped GET /api/creators/[id]/teaser instead (name, join date, counts).
 * Returns the same 404 whether `id` doesn't exist, isn't a CREATOR, or
 * hasn't consented — getCreatorPublicProfile already collapses those cases
 * so a probing caller learns nothing about which it was.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return toErrorResponse(error);
  }

  const profile = await getCreatorPublicProfile(params.id);
  if (!profile) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return Response.json(profile, { status: 200 });
}
