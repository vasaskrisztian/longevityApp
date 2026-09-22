import { logger } from '@/lib/logging/logger';
import { ProviderTokenExchangeError } from '../../domain/errors';
import {
  OURA_AUTHORIZE_URL,
  OURA_TOKEN_URL,
  OURA_REVOKE_URL,
  OURA_REQUESTED_SCOPES,
  loadOuraCredentials,
} from './oura-config';
import type { OuraTokenResponse } from './oura-types';

/**
 * The only file that ever makes a real HTTP call to Oura. Everything here
 * is plain `fetch` — no Oura SDK dependency to keep track of.
 */

export function buildOuraAuthorizeUrl(params: { state: string; codeChallenge: string }): string {
  const { clientId, redirectUri } = loadOuraCredentials();
  const url = new URL(OURA_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', OURA_REQUESTED_SCOPES.join(' '));
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

async function postOuraTokenRequest(body: Record<string, string>): Promise<OuraTokenResponse> {
  const response = await fetch(OURA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ProviderTokenExchangeError('OURA', `HTTP ${response.status}`, text);
  }

  return (await response.json()) as OuraTokenResponse;
}

export async function exchangeOuraAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
}): Promise<OuraTokenResponse> {
  const { clientId, clientSecret, redirectUri } = loadOuraCredentials();
  return postOuraTokenRequest({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: params.codeVerifier,
  });
}

export async function refreshOuraAccessToken(params: {
  refreshToken: string;
}): Promise<OuraTokenResponse> {
  const { clientId, clientSecret } = loadOuraCredentials();
  return postOuraTokenRequest({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
}

/**
 * Best-effort only — see OURA_REVOKE_URL's comment in oura-config.ts. A
 * failure here (network error, non-2xx, or missing client config) is
 * logged and swallowed; it must never block the caller's local revocation
 * (deleting the stored credential and marking the connection DISCONNECTED),
 * which is what actually protects the user regardless of whether Oura's
 * own token store agrees.
 */
export async function revokeOuraTokens(params: { accessToken: string }): Promise<void> {
  let clientId: string;
  let clientSecret: string;
  try {
    ({ clientId, clientSecret } = loadOuraCredentials());
  } catch {
    return;
  }

  try {
    const response = await fetch(OURA_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: params.accessToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
    if (!response.ok) {
      logger.warn('oura_revoke_non_ok_response', { status: response.status });
    }
  } catch (error) {
    logger.warn('oura_revoke_request_failed', { message: (error as Error).message });
  }
}
