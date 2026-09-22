import { describe, it, expect } from 'vitest';
import {
  mockExchangeAuthorizationCode,
  mockRefreshAccessToken,
  mockRevokeTokens,
} from '@/modules/wearable/providers/oura/oura-mock';
import { OURA_REQUESTED_SCOPES } from '@/modules/wearable/providers/oura/oura-config';

describe('mockExchangeAuthorizationCode', () => {
  it('returns a well-formed OuraTokenResponse-shaped object', async () => {
    const result = await mockExchangeAuthorizationCode();

    expect(result.access_token).toMatch(/^mock-access-/);
    expect(result.refresh_token).toMatch(/^mock-refresh-/);
    expect(result.token_type).toBe('bearer');
    expect(result.expires_in).toBe(3600);
    expect(result.scope).toBe(OURA_REQUESTED_SCOPES.join(' '));
  });

  it('generates a different token on every call (no shared mutable counter)', async () => {
    const a = await mockExchangeAuthorizationCode();
    const b = await mockExchangeAuthorizationCode();
    expect(a.access_token).not.toBe(b.access_token);
    expect(a.refresh_token).not.toBe(b.refresh_token);
  });
});

describe('mockRefreshAccessToken', () => {
  it('returns a fresh token pair, distinct from the previous one', async () => {
    const a = await mockRefreshAccessToken();
    const b = await mockRefreshAccessToken();
    expect(a.access_token).not.toBe(b.access_token);
  });
});

describe('mockRevokeTokens', () => {
  it('resolves without throwing (nothing to call in mock mode)', async () => {
    await expect(mockRevokeTokens()).resolves.toBeUndefined();
  });
});
