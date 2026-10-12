import { LoginSchema } from '@/lib/validation/auth.schemas';
import { verifyUserCredentials } from '@/modules/auth/auth.service';
import { issueMobileSession } from '@/modules/auth/mobile-session.service';
import { checkRateLimit, getClientIdentifier, AUTH_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { logger } from '@/lib/logging/logger';

/**
 * Login for the Expo app (iOS, Android and web) — issues a Bearer access
 * token + rotating refresh token (lib/auth/mobile-jwt.ts /
 * modules/auth/mobile-session.service.ts). This is the only login there is:
 * the old cookie session (NextAuth) was retired with the Next.js UI.
 * Credentials are judged by auth.service.ts's verifyUserCredentials, so
 * "wrong password", "inactive account", "unverified email" etc. have one
 * definition — the rate-limit scope is kept separate so a flood of mobile login
 * attempts can't lock out web users sharing the same IP, or vice versa.
 */
export async function POST(request: Request) {
  const identifier = getClientIdentifier(request);
  const rateLimit = checkRateLimit('mobile-login', identifier, AUTH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await verifyUserCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    // Same generic message regardless of which check failed — see
    // verifyUserCredentials' own doc comment on why.
    return Response.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const session = await issueMobileSession(user);

  logger.info('mobile_login_success', { userId: user.id });

  return Response.json({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    user: { id: user.id, email: user.email, role: user.role },
  });
}
