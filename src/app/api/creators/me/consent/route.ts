import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { SetPublicProfileConsentSchema } from '@/lib/validation/creator.schemas';
import {
  setPublicProfileConsent,
  revokePublicProfileConsent,
  NotACreatorError,
} from '@/modules/creators/creators.service';
import { logger } from '@/lib/logging/logger';

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
