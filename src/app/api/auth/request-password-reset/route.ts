import { RequestPasswordResetSchema } from '@/lib/validation/auth.schemas';
import { requestPasswordReset } from '@/modules/auth/auth.service';
import { checkRateLimit, getClientIdentifier, AUTH_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { logger } from '@/lib/logging/logger';
import { sendEmail } from '@/lib/email/mailer';
import { resolveWebAppOrigin } from '@/lib/http/app-url';

// Real sending goes through lib/email/mailer.ts (Resend, with a
// console-log fallback when RESEND_API_KEY isn't configured) — see
// api/auth/register/route.ts's sendVerificationEmail for the same pattern.
async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${resolveWebAppOrigin()}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset your password — Longevity Klub',
    html: `<p>We received a request to reset your Longevity Klub password. Click the link below to choose a new one:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't be changed.</p>`,
    text: `We received a request to reset your Longevity Klub password. Open this link to choose a new one:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't be changed.`,
  });
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
      // Awaited — see register/route.ts's identical comment on why
      // sendEmail() must be awaited rather than fire-and-forget.
      await sendPasswordResetEmail(parsed.data.email, rawToken);
    }
  } catch (error) {
    logger.error('password_reset_request_failed', { message: (error as Error).message });
  }

  // Identical response whether or not the account exists — see
  // ARCHITECTURE.md §10, threat 7 (user enumeration).
  return Response.json(GENERIC_RESPONSE, { status: 200 });
}
