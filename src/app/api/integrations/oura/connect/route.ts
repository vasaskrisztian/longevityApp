import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { generatePkcePair } from '@/lib/auth/pkce';
import { checkRateLimit, AUTH_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { createOAuthState } from '@/modules/wearable/services/oauth-state.service';
import { getOuraProvider } from '@/modules/wearable/providers/oura/oura-provider';
import { ProviderNotConfiguredError } from '@/modules/wearable/domain/errors';

/**
 * ARCHITECTURE.md §5, step 1: generate state + PKCE, persist OAuthState,
 * redirect the browser to Oura's authorize screen. No business logic beyond
 * that orchestration lives here — the actual URL shape is
 * OuraProvider.buildAuthorizationUrl()'s job.
 *
 * Phase 9: §4.3/§10 threat #6 list this endpoint among the ones that must be
 * rate-limited, alongside /login, /register, /password-reset, and the sync
 * endpoint — it was missed when Phase 4 built the OAuth flow. Keyed by the
 * caller's own user id (this is an authenticated endpoint, so there's no
 * anonymous-IP case to worry about, and per-user is the right scope: it
 * caps how many OAuthState rows / Oura-authorize redirects one account can
 * generate, independent of how many other accounts happen to share an IP).
 */
export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const rateLimit = checkRateLimit('oura-connect', userId, AUTH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Too many connection attempts. Please try again later.' },
      { status: 429 },
    );
  }

  const provider = getOuraProvider();

  let redirectUri: string;
  try {
    redirectUri = provider.getRedirectUri();
  } catch (error) {
    if (error instanceof ProviderNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  const { codeVerifier, codeChallenge } = generatePkcePair();
  const { state } = await createOAuthState({
    userId,
    provider: provider.id,
    redirectUri,
    codeVerifier,
  });

  const authorizationUrl = provider.buildAuthorizationUrl({ state, codeChallenge });
  return Response.redirect(authorizationUrl, 302);
}
