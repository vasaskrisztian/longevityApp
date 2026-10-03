import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from '@/lib/auth/auth.config';
import { verifyUserCredentials } from '@/modules/auth/auth.service';
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

        // The actual credential check — constant-shape failure, active/
        // verified checks, lastLoginAt bump — lives in auth.service.ts,
        // shared with the mobile login route (api/auth/mobile/login).
        const user = await verifyUserCredentials(parsed.data.email, parsed.data.password);
        if (!user) {
          return null;
        }

        return { id: user.id, role: user.role, email: user.email, name: null };
      },
    }),
  ],
});
