import { Resend } from 'resend';
import { logger } from '@/lib/logging/logger';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Resend's own test-mode sender — works with no domain verification at
// all, so a fresh deployment can send real email before anyone has set up
// EMAIL_FROM on a verified kardi-soft.hu address. Resend only allows this
// address to deliver to the account owner's own verified email though, so
// production use still needs EMAIL_FROM set to a verified domain address.
const RESEND_TEST_FROM = 'Longevity Klub <onboarding@resend.dev>';

// Lazy singleton, mirroring lib/queue/connection.ts's getRedisConnection —
// avoids re-instantiating the SDK on every hot-reloaded import in dev, and
// avoids ever constructing it (or touching RESEND_API_KEY) when no key is
// configured at all (local dev, CI, this app's test suite).
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/** Test-only escape hatch, mirroring connection.ts's `_resetConnectionForTests`. */
export function _resetMailerClientForTests(): void {
  resendClient = null;
}

/**
 * Sends a transactional email via Resend. When RESEND_API_KEY isn't
 * configured — local dev, CI, and this app's own test suite, none of which
 * set it — falls back to logging the email to the console instead, the
 * same dev-only behavior every call site (register, request-password-reset)
 * already had before a real provider was wired up here.
 *
 * Never throws. A Resend outage or a misconfigured EMAIL_FROM must not
 * turn an auth flow into a 500 for the caller: by the time this is called,
 * the user row and the single-use token are already committed, so the
 * action itself already succeeded regardless of whether the email makes
 * it out. Failures are logged (allowlisted fields only — see logger.ts;
 * never the recipient's full address or the email body/token) so they
 * show up in Railway's logs the same way the dev-only link already did.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const emailDomain = input.to.split('@')[1] ?? '';
  const client = getResendClient();

  if (!client) {
    // eslint-disable-next-line no-console
    console.log(`[dev-only] Email to ${input.to} (${input.subject}):\n${input.text}`);
    return;
  }

  try {
    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM ?? RESEND_TEST_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (error) {
      logger.error('email_send_failed', {
        emailDomain,
        errorName: error.name,
        statusCode: error.statusCode ?? undefined,
      });
      return;
    }

    logger.info('email_sent', { emailDomain, subject: input.subject });
  } catch (err) {
    logger.error('email_send_failed', { emailDomain, message: (err as Error).message });
  }
}
