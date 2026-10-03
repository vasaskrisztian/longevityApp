import { headers } from 'next/headers';
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

  // The web app's own page navigates the browser here directly (a cookie
  // session rides along automatically), so a 302 straight to Oura is
  // correct. The Expo mobile app (phase 16) authenticates with a Bearer
  // token instead of a cookie — opening this URL in a system/in-app browser
  // would carry none of that, since a browser navigation can't attach a
  // custom Authorization header. So a Bearer-authenticated caller gets the
  // URL back as data instead, and opens it itself (mobile/app/(tabs)/
  // devices.tsx, phase 19) — Oura's own authorize page needs no auth header
  // at all, only the state/PKCE challenge already embedded in the URL.
  const isMobileBearerAuth = (await headers()).get('authorization')?.startsWith('Bearer ') ?? false;
  if (isMobileBearerAuth) {
    return Response.json({ authorizationUrl }, { status: 200 });
  }
  return Response.redirect(authorizationUrl, 302);
}
