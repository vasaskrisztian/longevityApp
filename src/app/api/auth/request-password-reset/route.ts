import { RequestPasswordResetSchema } from '@/lib/validation/auth.schemas';
import { requestPasswordReset } from '@/modules/auth/auth.service';
import { checkRateLimit, getClientIdentifier, AUTH_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { logger } from '@/lib/logging/logger';

function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.APP_URL ?? ''}/reset-password?token=${token}`;
  // eslint-disable-next-line no-console
  console.log(`[dev-only] Password reset link for ${email}: ${resetUrl}`);
}

const GENERIC_RESPONSE = {
  message: 'If this email is registered, a password reset link has been sent.',
};

export async function POST(request: Request) {
  const identifier = getClientIdentifier(request);
  const rateLimit = checkRateLimit('password-reset-request', identifier, AUTH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = RequestPasswordResetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const rawToken = await requestPasswordReset(parsed.data.email);
    if (rawToken) {
      sendPasswordResetEmail(parsed.data.email, rawToken);
    }
  } catch (error) {
    logger.error('password_reset_request_failed', { message: (error as Error).message });
  }

  // Identical response whether or not the account exists — see
  // ARCHITECTURE.md §10, threat 7 (user enumeration).
  return Response.json(GENERIC_RESPONSE, { status: 200 });
}
