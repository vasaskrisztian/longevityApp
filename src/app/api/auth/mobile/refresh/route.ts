import { MobileRefreshTokenSchema } from '@/lib/validation/auth.schemas';
import { rotateMobileRefreshToken } from '@/modules/auth/mobile-session.service';
import { checkRateLimit, getClientIdentifier, AUTH_RATE_LIMIT } from '@/lib/auth/rate-limit';

/**
 * Exchanges a still-valid refresh token for a fresh access+refresh pair.
 * The mobile app calls this when an API request comes back 401 with an
 * expired access token, rather than forcing the user to log in again every
 * 15 minutes. See mobile-session.service.ts's rotateMobileRefreshToken for
 * the rotation/reuse-detection behavior.
 */
export async function POST(request: Request) {
  const identifier = getClientIdentifier(request);
  const rateLimit = checkRateLimit('mobile-refresh', identifier, AUTH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = MobileRefreshTokenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const session = await rotateMobileRefreshToken(parsed.data.refreshToken);
  if (!session) {
    return Response.json({ error: 'Invalid or expired refresh token.' }, { status: 401 });
  }

  return Response.json({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
  });
}
