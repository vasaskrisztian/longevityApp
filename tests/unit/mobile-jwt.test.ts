import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { signMobileAccessToken, verifyMobileAccessToken } from '@/lib/auth/mobile-jwt';

// AUTH_SECRET is set to 'test-secret' by tests/setup/env.ts.

const PAYLOAD = { sub: 'user-1', role: 'USER' as const, email: 'jane@example.com' };

describe('signMobileAccessToken / verifyMobileAccessToken', () => {
  it('round-trips a signed token back to the original payload', async () => {
    const token = await signMobileAccessToken(PAYLOAD);
    await expect(verifyMobileAccessToken(token)).resolves.toEqual(PAYLOAD);
  });

  it('rejects a malformed token', async () => {
    await expect(verifyMobileAccessToken('not-a-jwt')).resolves.toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = await new SignJWT({ role: 'ADMIN', email: 'eve@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('eve')
      .setIssuer('longevity-klub-mobile')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('wrong-secret'));

    await expect(verifyMobileAccessToken(forged)).resolves.toBeNull();
  });

  it('rejects a token with the wrong issuer', async () => {
    const wrongIssuer = await new SignJWT({ role: 'USER', email: 'jane@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('some-other-issuer')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));

    await expect(verifyMobileAccessToken(wrongIssuer)).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    const expired = await new SignJWT({ role: 'USER', email: 'jane@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('longevity-klub-mobile')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));

    await expect(verifyMobileAccessToken(expired)).resolves.toBeNull();
  });
});
