import { getCreatorPublicProfile } from '@/modules/creators/creators.service';

interface RouteParams {
  params: { id: string };
}

/**
 * Also deliberately public (see /api/creators/route.ts). Returns the same
 * 404 whether `id` doesn't exist, isn't a CREATOR, or hasn't consented —
 * getCreatorPublicProfile already collapses those cases so a probing
 * caller learns nothing about which it was.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const profile = await getCreatorPublicProfile(params.id);
  if (!profile) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return Response.json(profile, { status: 200 });
}
