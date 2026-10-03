import { MobileRefreshTokenSchema } from '@/lib/validation/auth.schemas';
import { revokeMobileRefreshToken } from '@/modules/auth/mobile-session.service';

/**
 * Revokes the presented refresh token so it can't be used to mint further
 * access tokens — called when the user explicitly logs out of the mobile
 * app. Always responds 200 (a logout for a token that's already invalid or
 * unknown is still a successful logout from the client's point of view);
 * the access token already issued simply expires on its own within
 * MOBILE_ACCESS_TOKEN_TTL_SECONDS regardless.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = MobileRefreshTokenSchema.safeParse(body);
  if (parsed.success) {
    await revokeMobileRefreshToken(parsed.data.refreshToken);
  }

  return Response.json({ message: 'Logged out.' });
}
