import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth/auth.config';

// Deliberately built from the Edge-safe `authConfig`, NOT `@/lib/auth/auth`
// — that file pulls in argon2 (native Node addon) and Prisma via the
// Credentials provider, neither of which the Edge runtime that middleware
// executes in can bundle. This `auth` only ever reads the JWT.
const { auth } = NextAuth(authConfig);

/**
 * UX-layer route guard only — redirects an unauthenticated visitor to
 * /login and a non-admin away from /admin before a page even renders.
 *
 * This is NOT the authorization boundary. Every Server Component, Route
 * Handler and Server Action re-checks with requireAuthenticatedUser /
 * requireAdmin / requireOwnResourceOrAdmin (src/lib/auth/authorization.ts)
 * regardless of what middleware already did — see ARCHITECTURE.md §4.2.
 */
export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isLoggedIn = Boolean(request.auth?.user);

  const protectedPrefixes = ['/dashboard', '/trends', '/profile', '/admin', '/onboarding'];
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL('/login', request.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/admin') && request.auth?.user?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/trends/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
  ],
};
