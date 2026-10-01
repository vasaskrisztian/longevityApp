import { listPublicCreators } from '@/modules/creators/creators.service';

export const dynamic = 'force-dynamic';

/**
 * Deliberately public — no requireAuthenticatedUser. This is the one
 * category of data ARCHITECTURE.md §4.2's "everything is private by
 * default" model doesn't apply to: a CREATOR who has consented to a
 * public profile (see creators.service.ts's doc comment) is meant to be
 * discoverable by anyone, logged in or not — that's the whole point of
 * the directory for the business's "named creators attract followers"
 * model. Nothing here ever returns a MEMBER account or a non-consenting
 * CREATOR.
 */
export async function GET() {
  const creators = await listPublicCreators();
  return Response.json(creators, { status: 200 });
}
