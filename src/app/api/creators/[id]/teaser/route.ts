import { getCreatorTeaser } from '@/modules/creators/creators.service';
import { checkRateLimit, getClientIdentifier } from '@/lib/auth/rate-limit';

// Always-fresh public counts — never statically cached.
export const dynamic = 'force-dynamic';

// Unauthenticated and keyed by an id in the URL, so it is rate-limited per
// client IP to blunt id-probing/scraping. Generous enough for a visitor
// flicking through the directory.
const TEASER_RATE_LIMIT = { windowMs: 60 * 1000, max: 60 };

interface RouteParams {
  params: { id: string };
}

/**
 * The signed-out teaser for one creator: name, join date and counts only
 * (see getCreatorTeaser). Unlike GET /api/creators/[id] this never returns
 * protocol/challenge content or health metrics, so it is what the mobile
 * app shows to visitors who haven't registered yet. Same 404 for missing /
 * non-creator / non-consenting ids.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const limit = checkRateLimit('creator-teaser', getClientIdentifier(request), TEASER_RATE_LIMIT);
  if (!limit.allowed) {
    return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const teaser = await getCreatorTeaser(params.id);
  if (!teaser) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return Response.json(teaser, { status: 200 });
}
