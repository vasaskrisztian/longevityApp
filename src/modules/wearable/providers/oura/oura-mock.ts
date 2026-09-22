import { randomBytes } from 'node:crypto';
import { OURA_REQUESTED_SCOPES } from './oura-config';
import type { OuraTokenResponse } from './oura-types';

/**
 * OURA_MOCK_MODE=true stand-ins — no network call, so the whole connect/
 * callback/refresh/disconnect flow is developable and demoable without a
 * real Oura account or production API approval (ARCHITECTURE.md §11).
 * Each call generates a fresh random suffix rather than using a module-level
 * counter, so these stay safe under concurrent/parallel test execution.
 */

function randomSuffix(): string {
  return randomBytes(8).toString('hex');
}

export async function mockExchangeAuthorizationCode(): Promise<OuraTokenResponse> {
  const suffix = randomSuffix();
  return {
    access_token: `mock-access-${suffix}`,
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: `mock-refresh-${suffix}`,
    scope: OURA_REQUESTED_SCOPES.join(' '),
  };
}

export async function mockRefreshAccessToken(): Promise<OuraTokenResponse> {
  const suffix = randomSuffix();
  return {
    access_token: `mock-access-${suffix}`,
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: `mock-refresh-${suffix}`,
    scope: OURA_REQUESTED_SCOPES.join(' '),
  };
}

export async function mockRevokeTokens(): Promise<void> {
  // Nothing to call in mock mode.
}
