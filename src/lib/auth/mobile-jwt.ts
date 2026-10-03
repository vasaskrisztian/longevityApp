import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '@prisma/client';

/**
 * Short-lived Bearer access tokens for the Expo mobile app. The web app
 * authenticates with NextAuth's own (JWE-encrypted) session cookie — this
 * is a deliberately separate, independent token format for clients that
 * can't rely on an HttpOnly cookie, reusing AUTH_SECRET (already
 * provisioned for Auth.js) rather than adding a second secret to manage.
 * Long-lived sessions are handled by the rotating MobileRefreshToken
 * instead (see modules/auth/mobile-session.service.ts) — this token is
 * intentionally too short-lived to be worth revoking directly.
 */
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const ISSUER = 'longevity-klub-mobile';

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

export interface MobileAccessTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
}

export async function signMobileAccessToken(payload: MobileAccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Never throws — an expired, malformed, wrong-signature, or wrong-issuer
 * token all fail closed to `null`, exactly like verifyPassword's catch-all
 * for a malformed hash. Callers (authorization.ts) treat `null` the same
 * as "no Bearer token at all".
 */
export async function verifyMobileAccessToken(token: string): Promise<MobileAccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { issuer: ISSUER });
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string' || typeof payload.email !== 'string') {
      return null;
    }
    return { sub: payload.sub, role: payload.role as UserRole, email: payload.email };
  } catch {
    return null;
  }
}

export const MOBILE_ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_SECONDS;
