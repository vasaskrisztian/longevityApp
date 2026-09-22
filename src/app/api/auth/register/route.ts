import { RegisterSchema } from '@/lib/validation/auth.schemas';
import { registerUser, EmailAlreadyRegisteredError } from '@/modules/auth/auth.service';
import { checkRateLimit, getClientIdentifier, AUTH_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { logger } from '@/lib/logging/logger';

// TODO(Phase 2/mailer): wire a real transactional email provider. For now
// the verification link is logged server-side only — it must never be
// returned in the HTTP response body.
function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${process.env.APP_URL ?? ''}/api/auth/verify-email?token=${token}`;
  logger.info('verification_email_dispatched', { emailDomain: email.split('@')[1] ?? '' });
  // eslint-disable-next-line no-console
  console.log(`[dev-only] Verification link for ${email}: ${verifyUrl}`);
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
    sendVerificationEmail(parsed.data.email, verificationToken);
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
