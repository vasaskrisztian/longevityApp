import type { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { generateRawToken, hashToken } from '@/lib/auth/tokens';
import { signMobileAccessToken, MOBILE_ACCESS_TOKEN_TTL_SECONDS } from '@/lib/auth/mobile-jwt';
import { logger } from '@/lib/logging/logger';

// 30 days — long enough that a user isn't forced to re-enter their
// password constantly on mobile, rotated on every refresh (see below) so a
// stolen-but-unused token has a real expiry ceiling rather than lasting
// forever.
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface MobileSessionUser {
  id: string;
  role: UserRole;
  email: string;
}

export interface MobileSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Issues a brand-new access+refresh pair for a user who just logged in. */
export async function issueMobileSession(user: MobileSessionUser): Promise<MobileSession> {
  const accessToken = await signMobileAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = generateRawToken();

  await prisma.mobileRefreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { accessToken, refreshToken, expiresIn: MOBILE_ACCESS_TOKEN_TTL_SECONDS };
}

/**
 * Rotates a refresh token: the presented token is revoked and a fresh
 * access+refresh pair is issued in its place. Returns null for anything
 * that isn't a valid, currently-active token — never throws, so the route
 * can always respond with a plain 401.
 *
 * Reuse of an already-revoked token is treated as a sign that token leaked:
 * every other still-active refresh token for that user is revoked too
 * (forcing a fresh login everywhere), rather than just rejecting this one
 * request.
 */
export async function rotateMobileRefreshToken(rawToken: string): Promise<MobileSession | null> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.mobileRefreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) {
    return null;
  }

  if (record.revokedAt) {
    await prisma.mobileRefreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    logger.warn('mobile_refresh_token_reuse_detected', { userId: record.userId });
    return null;
  }

  if (record.expiresAt < new Date()) {
    return null;
  }

  await prisma.mobileRefreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  logger.info('mobile_refresh_token_rotated', { userId: record.userId });

  return issueMobileSession({ id: record.user.id, role: record.user.role, email: record.user.email });
}

/** Best-effort logout — revokes the token if it's still active; never throws. */
export async function revokeMobileRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.mobileRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
