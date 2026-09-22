import type { NextAuthConfig } from 'next-auth';

/**
 * The Edge-runtime-safe half of the Auth.js config. `middleware.ts` runs in
 * the Edge runtime and must import ONLY this file — never `auth.ts`, which
 * pulls in the Credentials provider's `argon2` (native Node addon) and
 * Prisma (Node-only native query engine). Mixing those into middleware
 * breaks the build ("node:crypto ... Unhandled scheme").
 *
 * `providers` is intentionally empty here; `auth.ts` adds the real
 * Credentials provider on top of this config for use in Route Handlers and
 * Server Components, which run in the Node runtime.
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  // Railway (like most non-Vercel hosts) terminates TLS at its edge proxy
  // and forwards to the container over plain HTTP with an internal Host
  // header (e.g. `localhost:8080`), which doesn't match the public domain.
  // Without `trustHost`, Auth.js rejects every request as an "UntrustedHost"
  // — this must be true for auth to work at all behind that kind of proxy.
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
