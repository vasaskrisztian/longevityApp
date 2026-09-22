import { randomBytes, createHash } from 'node:crypto';

/**
 * RFC 7636 PKCE (Proof Key for Code Exchange) — generic to any OAuth2
 * Authorization Code flow, not Oura-specific, so it lives in lib/auth/ next
 * to the other bearer-token helpers (tokens.ts) rather than under
 * modules/wearable. Any future provider (Garmin, Whoop, ...) that also does
 * Authorization Code + PKCE reuses this unchanged.
 */
export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export function generatePkcePair(): PkcePair {
  // 32 random bytes -> 43-char base64url string, comfortably inside RFC
  // 7636's required 43-128 character range for the verifier.
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge, codeChallengeMethod: 'S256' };
}
