import { randomBytes, createHash } from 'node:crypto';

/**
 * Shared helper for password-reset and email-verification tokens: the raw
 * token is only ever transmitted in an email link; the DB stores a SHA-256
 * hash of it (PasswordResetToken.tokenHash / EmailVerificationToken.tokenHash),
 * per ARCHITECTURE.md §4.5. This is not "encryption" — it's the standard
 * one-way pattern for bearer tokens: even a DB dump is useless for logging in.
 */
export function generateRawToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
