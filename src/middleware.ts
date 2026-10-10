import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth/auth.config';
import { resolveAppUrl } from '@/lib/http/app-url';
import { corsHeaders, isCorsEligiblePath, resolveCorsOrigin } from '@/lib/http/cors';

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
const authMiddleware = auth((request) => {
  const { pathname } = request.nextUrl;
  const isLoggedIn = Boolean(request.auth?.user);

  const protectedPrefixes = ['/dashboard', '/trends', '/profile', '/admin', '/onboarding', '/notifications'];
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !isLoggedIn) {
    // request.nextUrl.origin is the container's internal localhost:PORT
    // behind Railway's proxy (see lib/http/app-url.ts) — resolveAppUrl
    // prefers APP_URL so this actually redirects to the public domain.
    const loginUrl = resolveAppUrl('/login', request.nextUrl.href);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/admin') && request.auth?.user?.role !== 'ADMIN') {
    return NextResponse.redirect(resolveAppUrl('/dashboard', request.nextUrl.href));
  }

  return NextResponse.next();
});

/**
 * Opt-in CORS for `/api/*` (see lib/http/cors.ts). A no-op unless
 * `CORS_ALLOWED_ORIGINS` is set AND the request's Origin is on that list:
 * same-origin and native-app requests carry no/other Origin and pass
 * through untouched, and a preflight from an unlisted origin is simply
 * forwarded to the route (which has no OPTIONS handler -> 405, no CORS
 * headers -> the browser blocks it).
 */
function handleApiCors(request: NextRequest): NextResponse {
  const allowedOrigin = resolveCorsOrigin(
    request.headers.get('origin'),
    process.env.CORS_ALLOWED_ORIGINS,
  );
  const isPreflight = request.method === 'OPTIONS';
  if (!allowedOrigin) return NextResponse.next();
  if (isPreflight) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(allowedOrigin, true) });
  }
  const response = NextResponse.next();
  for (const [name, value] of Object.entries(corsHeaders(allowedOrigin, false))) {
    response.headers.set(name, value);
  }
  return response;
}

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (isCorsEligiblePath(request.nextUrl.pathname)) {
    return handleApiCors(request);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (authMiddleware as any)(request, event);
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/trends/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
  ],
};
