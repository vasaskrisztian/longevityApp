/**
 * Oura's own wire shapes (OAuth token endpoint JSON). Nothing outside this
 * directory may import this file — enforced by .eslintrc.json's
 * no-restricted-imports rule. Everything else in the app sees only the
 * provider-agnostic OAuthTokenSet from domain/wearable-provider.types.ts;
 * oura-auth.ts and oura-mock.ts are the only places that map between the two.
 */
export interface OuraTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface OuraErrorResponse {
  error: string;
  error_description?: string;
}
