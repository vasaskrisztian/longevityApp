import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { generatePkcePair } from '@/lib/auth/pkce';

describe('generatePkcePair', () => {
  it('produces a code_verifier within RFC 7636\'s 43-128 character range', () => {
    const { codeVerifier } = generatePkcePair();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeVerifier.length).toBeLessThanOrEqual(128);
  });

  it('the code_challenge is the base64url-SHA256 of the verifier (S256)', () => {
    const { codeVerifier, codeChallenge, codeChallengeMethod } = generatePkcePair();
    expect(codeChallengeMethod).toBe('S256');
    expect(codeChallenge).toBe(createHash('sha256').update(codeVerifier).digest('base64url'));
  });

  it('produces a different pair on every call', () => {
    const a = generatePkcePair();
    const b = generatePkcePair();
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
    expect(a.codeChallenge).not.toBe(b.codeChallenge);
  });

  it('the verifier and challenge are URL-safe (no +, /, or = padding)', () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    expect(codeVerifier).not.toMatch(/[+/=]/);
    expect(codeChallenge).not.toMatch(/[+/=]/);
  });
});
