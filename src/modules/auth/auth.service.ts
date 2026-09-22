import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { generateRawToken, hashToken } from '@/lib/auth/tokens';
import { logger } from '@/lib/logging/logger';
import type { RegisterInput } from '@/lib/validation/auth.schemas';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

/**
 * Registers a new user. Terms/Privacy acceptance timestamps are stamped
 * server-side, at the moment of this call — never inferred from a checkbox
 * being checked at some earlier point in the client. Returns the raw email
 * verification token so the caller (the API route) can send it by email;
 * only the HASH is ever persisted.
 */
export async function registerUser(input: RegisterInput): Promise<{
  userId: string;
  verificationToken: string;
}> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // The API route deliberately returns a generic "check your email"
    // response regardless of this branch, to avoid user enumeration.
    throw new EmailAlreadyRegisteredError();
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
    },
  });

  const verificationToken = generateRawToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(verificationToken),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });

  // Profile.fullName is required by the schema but onboarding (Phase 2) is
  // where height/weight/timezone etc. are collected; we stash fullName here
  // so it isn't lost, via a minimal profile row the onboarding wizard
  // completes rather than creates from scratch.
  await prisma.profile.create({
    data: {
      userId: user.id,
      fullName: input.fullName,
      birthDate: new Date(0),
      heightCm: 0,
      weightKg: 0,
      timezone: 'UTC',
    },
  });

  logger.info('user_registered', { userId: user.id });

  return { userId: user.id, verificationToken };
}

export async function verifyEmail(rawToken: string): Promise<boolean> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return false;
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  logger.info('email_verified', { userId: record.userId });
  return true;
}

/**
 * Always succeeds from the caller's point of view (the API route always
 * responds with the same generic message) — whether or not the email
 * exists is never revealed. Returns the raw token only when a user was
 * actually found, so the route can decide whether to send an email.
 */
export async function requestPasswordReset(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return null;
  }

  const rawToken = generateRawToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });

  logger.info('password_reset_requested', { userId: user.id });
  return rawToken;
}

export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<boolean> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return false;
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
  ]);

  logger.info('password_reset_completed', { userId: record.userId });
  return true;
}
