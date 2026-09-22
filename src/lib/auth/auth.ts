import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { UserStatus } from '@prisma/client';
import { authConfig } from '@/lib/auth/auth.config';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { LoginSchema } from '@/lib/validation/auth.schemas';
import { logger } from '@/lib/logging/logger';
import { checkRateLimit, getClientIdentifier, AUTH_RATE_LIMIT } from '@/lib/auth/rate-limit';

/**
 * Auth.js (NextAuth v5) configuration — Node runtime only (Route Handlers,
 * Server Actions, Server Components). Extends the Edge-safe `authConfig`
 * (src/lib/auth/auth.config.ts) with the Credentials provider, which needs
 * Prisma and argon2 — neither of which can run in Edge middleware. See
 * middleware.ts, which imports authConfig directly instead of this file.
 *
 * - Credentials provider (email + password) is the only provider enabled in
 *   the MVP. `Account`/`Session`/`VerificationToken` tables already exist in
 *   the schema so adding a Google provider later is a config-only change.
 * - JWT session strategy: stateless, works cleanly with middleware and
 *   Route Handlers, and avoids a DB round-trip on every request.
 * - The credentials `authorize()` callback is the ONLY place a password
 *   comparison happens, and it deliberately gives an identical error for
 *   "no such user" and "wrong password" (see ARCHITECTURE.md §10, threat 7).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials, request) {
        const identifier = getClientIdentifier(request);
        const rateLimit = checkRateLimit('login', identifier, AUTH_RATE_LIMIT);
        if (!rateLimit.allowed) {
          logger.warn('login_rate_limited', { identifier });
          return null;
        }

        const parsed = LoginSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        // Constant-shape failure path: whether the user exists or the
        // password is wrong, we return null either way. We still run
        // verifyPassword against a dummy hash-shaped value when the user
        // doesn't exist, so the response time doesn't leak existence.
        const passwordHash = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$invalidinvalidinvalid$invalidinvalidinvalidinvalidinvalidinvalid';
        const isValid = await verifyPassword(passwordHash, password);

        if (!user || !isValid) {
          return null;
        }
        if (user.status !== UserStatus.ACTIVE) {
          logger.warn('login_blocked_inactive_account', { userId: user.id, status: user.status });
          return null;
        }
        if (!user.emailVerifiedAt) {
          logger.warn('login_blocked_unverified_email', { userId: user.id });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        logger.info('login_success', { userId: user.id });

        return { id: user.id, role: user.role, email: user.email, name: null };
      },
    }),
  ],
});
