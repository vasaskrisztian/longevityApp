import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { generateRawToken, hashToken } from '@/lib/auth/tokens';

describe('generateRawToken', () => {
  it('generates a URL-safe, sufficiently long token', () => {
    const token = generateRawToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('never generates the same token twice', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateRawToken()));
    expect(tokens.size).toBe(50);
  });
});

describe('hashToken', () => {
  it('is deterministic for the same input', () => {
    const token = generateRawToken();
    expect(hashToken(token)).toEqual(hashToken(token));
  });

  it('matches a plain SHA-256 hex digest', () => {
    const token = 'fixed-example-token';
    expect(hashToken(token)).toEqual(createHash('sha256').update(token).digest('hex'));
  });

  it('produces different hashes for different tokens', () => {
    expect(hashToken('token-a')).not.toEqual(hashToken('token-b'));
  });

  it('never returns the raw token itself', () => {
    const token = generateRawToken();
    expect(hashToken(token)).not.toEqual(token);
  });
});
