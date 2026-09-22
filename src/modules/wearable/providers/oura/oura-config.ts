import { ProviderNotConfiguredError } from '../../domain/errors';

/**
 * All Oura-specific configuration in one place. Nothing outside
 * modules/wearable/providers/oura/* may import this file — enforced by
 * .eslintrc.json's no-restricted-imports rule.
 */

// Oura API v2 endpoints. Oura does not publish a documented, stable token
// revocation endpoint as of this writing; OURA_REVOKE_URL is a best-effort
// target — see revokeOuraTokens in oura-auth.ts, which never lets a failed
// call block local revocation (that's the actual security boundary).
export const OURA_AUTHORIZE_URL = 'https://cloud.ouraring.com/oauth/authorize';
export const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';
export const OURA_REVOKE_URL = 'https://api.ouraring.com/oauth/revoke';

// ARCHITECTURE.md §5 "Key decisions": exact requested-scope list for the MVP.
export const OURA_REQUESTED_SCOPES = [
  'personal',
  'daily',
  'heartrate',
  'workout',
  'spo2Daily',
] as const;

export function isOuraMockMode(): boolean {
  return process.env.OURA_MOCK_MODE === 'true';
}

export interface OuraCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Throws ProviderNotConfiguredError if any of OURA_CLIENT_ID/
 * OURA_CLIENT_SECRET/OURA_REDIRECT_URI is missing. Callers in mock mode
 * never reach this — see oura-provider.ts, which branches on
 * isOuraMockMode() before any of these are needed.
 */
export function loadOuraCredentials(): OuraCredentials {
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  const redirectUri = process.env.OURA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new ProviderNotConfiguredError('OURA');
  }
  return { clientId, clientSecret, redirectUri };
}
