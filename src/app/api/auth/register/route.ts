import { RegisterSchema } from '@/lib/validation/auth.schemas';
import { registerUser, EmailAlreadyRegisteredError } from '@/modules/auth/auth.service';
import { checkRateLimit, getClientIdentifier, AUTH_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { logger } from '@/lib/logging/logger';
import { sendEmail } from '@/lib/email/mailer';
import { InvitationError } from '@/modules/groups/invitations.service';

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

function invitationErrorMessage(error: InvitationError): string {
  switch (error.reason) {
    case 'expired':
      return 'This invitation has expired. Ask the group administrator to send a new one.';
    case 'revoked':
    case 'invalid':
      return 'This invitation link is not valid.';
    case 'accepted':
      return 'This invitation has already been accepted — sign in instead.';
    case 'email_mismatch':
      return 'This invitation was sent to a different email address.';
  }
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
    // Resend actually completes. No token = registered from a group
    // invitation, which already proved the address (account is verified).
    if (verificationToken) {
      await sendVerificationEmail(parsed.data.email, verificationToken);
    } else {
      return Response.json({ message: 'Account created.', verified: true }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof InvitationError) {
      // Only reachable with an invite token, which the holder received by
      // email, so being specific here leaks nothing an attacker could use.
      return Response.json({ error: invitationErrorMessage(error), code: error.reason }, { status: 400 });
    }
    if (error instanceof EmailAlreadyRegisteredError && parsed.data.inviteToken) {
      // The invitation was valid for this address (checked first), so the
      // holder may be told to sign in instead of registering.
      return Response.json(
        { error: 'This email already has an account — sign in to accept the invitation.', code: 'account_exists' },
        { status: 409 },
      );
    }
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
