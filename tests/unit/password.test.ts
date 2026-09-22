import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('hashPassword', () => {
  it('produces an argon2id hash string, never the plaintext', async () => {
    const hash = await hashPassword('CorrectHorse123');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('CorrectHorse123');
  });

  it('produces a different hash each time (random salt)', async () => {
    const [a, b] = await Promise.all([
      hashPassword('SamePassword123'),
      hashPassword('SamePassword123'),
    ]);
    expect(a).not.toEqual(b);
  });
});

describe('verifyPassword', () => {
  it('returns true for the correct plaintext against its own hash', async () => {
    const hash = await hashPassword('CorrectHorse123');
    await expect(verifyPassword(hash, 'CorrectHorse123')).resolves.toBe(true);
  });

  it('returns false for an incorrect plaintext', async () => {
    const hash = await hashPassword('CorrectHorse123');
    await expect(verifyPassword(hash, 'WrongPassword123')).resolves.toBe(false);
  });

  it('fails closed (returns false, does not throw) for a malformed hash', async () => {
    await expect(verifyPassword('not-a-real-hash', 'anything')).resolves.toBe(false);
  });
});
