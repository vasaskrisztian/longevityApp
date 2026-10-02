import { RegisterSchema } from '@/lib/validation/auth.schemas';
import { registerUser, EmailAlreadyRegisteredError } from '@/modules/auth/auth.service';
import { checkRateLimit, getClientIdentifier, AUTH_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { logger } from '@/lib/logging/logger';
import { sendEmail } from '@/lib/email/mailer';

// Real sending goes through lib/email/mailer.ts (Resend, with a
// console-log fallback when RESEND_API_KEY isn't configured) — this
// function only owns the email's actual copy. The verification link must
// never be returned in the HTTP response body, only delivered by email.
async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${process.env.APP_URL ?? ''}/api/auth/verify-email?token=${token}`;
  logger.info('verification_email_dispatched', { emailDomain: email.split('@')[1] ?? '' });
  await sendEmail({
    to: email,
    subject: 'Confirm your email — Longevity Klub',
    html: `<p>Welcome to Longevity Klub! Confirm your email address to finish creating your account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>`,
    text: `Welcome to Longevity Klub! Confirm your email address to finish creating your account:\n${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create this account, you can ignore this email.`,
  });
}

export async function POST(request: Request) {
  const identifier = getClientIdentifier(request);
  const rateLimit = checkRateLimit('register', identifier, AUTH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { verificationToken } = await registerUser(parsed.data);
    // Awaited (not fire-and-forget): sendEmail() never throws, and without
    // awaiting here this handler's response could be sent — and the
    // function/request lifecycle torn down — before the outbound call to
    // Resend actually completes.
    await sendVerificationEmail(parsed.data.email, verificationToken);
  } catch (error) {
    if (!(error instanceof EmailAlreadyRegisteredError)) {
      logger.error('registration_failed', { message: (error as Error).message });
      return Response.json({ error: 'Registration failed' }, { status: 500 });
    }
    // Fall through: identical response whether or not the email already
    // existed, to prevent user enumeration (ARCHITECTURE.md §10, threat 7).
  }

  return Response.json(
    { message: 'If this email is valid, a verification link has been sent.' },
    { status: 201 },
  );
}
