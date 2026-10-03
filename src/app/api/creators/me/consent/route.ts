import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { SetPublicProfileConsentSchema } from '@/lib/validation/creator.schemas';
import {
  setPublicProfileConsent,
  revokePublicProfileConsent,
  getPublicProfileStatus,
  NotACreatorError,
} from '@/modules/creators/creators.service';
import { logger } from '@/lib/logging/logger';

/**
 * Phase 20 (mobile): the web app reads `accountType`/`publicProfileConsentAt`
 * straight from a server component (src/app/profile/page.tsx) to decide
 * whether to show the creator-consent section and its initial state. Mobile
 * has no server component, so this GET gives it the same two facts over the
 * wire — see creators.service.ts's getPublicProfileStatus doc comment.
 */
export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const status = await getPublicProfileStatus(userId);
  return Response.json(status, { status: 200 });
}

/**
 * The CREATOR's own explicit opt-in/opt-out of having a public profile at
 * all — separate from the registration-time termsAcceptedAt/
 * privacyAcceptedAt, and separate from any individual Protocol/Challenge's
 * own `visibility` flag (consenting here only makes a public profile
 * *possible*; the creator still picks which protocols/challenges to
 * publish). Revoking takes effect immediately — see
 * creators.service.ts's revokePublicProfileConsent.
 */
export async function PATCH(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = SetPublicProfileConsentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.consent) {
      await setPublicProfileConsent(userId);
    } else {
      await revokePublicProfileConsent(userId);
    }
    return Response.json({ consent: parsed.data.consent }, { status: 200 });
  } catch (error) {
    if (error instanceof NotACreatorError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    logger.error('creator_consent_update_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to update public profile consent' }, { status: 500 });
  }
}
