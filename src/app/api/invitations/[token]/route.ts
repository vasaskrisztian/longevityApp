import { checkRateLimit, getClientIdentifier, INVITATION_PREVIEW_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { previewInvitation } from '@/modules/groups/invitations.service';

/**
 * Public preview behind the emailed link: group name/logo, the invited
 * address and whether it already has an account. An unknown token only ever
 * answers `{ status: 'invalid' }`; the token is 256 bits of randomness and
 * the endpoint is rate-limited.
 */
export async function GET(request: Request, { params }: { params: { token: string } }) {
  const rateLimit = checkRateLimit('invitation-preview', getClientIdentifier(request), INVITATION_PREVIEW_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }
  return Response.json(await previewInvitation(params.token), { status: 200 });
}
