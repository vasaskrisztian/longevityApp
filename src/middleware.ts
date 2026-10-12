import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { corsHeaders, isCorsEligiblePath, resolveCorsOrigin } from '@/lib/http/cors';
import { isLegacyUiPath, legacyUiRedirectTarget } from '@/lib/http/legacy-ui-redirect';

/**
 * Two jobs, neither of them an authorization boundary (every Route Handler
 * re-checks with requireAuthenticatedUser / requireAdmin /
 * requireOwnResourceOrAdmin — see ARCHITECTURE.md §4.2):
 *
 * 1. Opt-in CORS for `/api/*` (see lib/http/cors.ts). A no-op unless
 *    `CORS_ALLOWED_ORIGINS` is set AND the request's Origin is on that list:
 *    same-origin and native-app requests carry no/other Origin and pass
 *    through untouched, and a preflight from an unlisted origin is simply
 *    forwarded to the route (which has no OPTIONS handler -> 405, no CORS
 *    headers -> the browser blocks it).
 * 2. This service no longer renders any UI: the former Next.js pages are
 *    forwarded to the Expo web app (`WEB_APP_URL`) — see
 *    lib/http/legacy-ui-redirect.ts. Without `WEB_APP_URL` they answer 404.
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

export default function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isCorsEligiblePath(pathname)) {
    return handleApiCors(request);
  }

  if (isLegacyUiPath(pathname)) {
    // Behind Railway's proxy request.nextUrl.origin is the container's own
    // localhost:PORT, so "is this the web app itself?" is judged against APP_URL.
    const self = process.env.APP_URL || request.nextUrl.origin;
    const target = legacyUiRedirectTarget(pathname, search, process.env.WEB_APP_URL, self);
    if (target) return NextResponse.redirect(target, 307);
    return NextResponse.json(
      { error: 'This service has no web pages. Open the Longevity Klub app instead.' },
      { status: 404 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/api/:path*',
    '/login',
    '/register',
    '/reset-password',
    '/invite/:path*',
    '/creators/:path*',
    '/dashboard/:path*',
    '/trends/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
    '/notifications/:path*',
  ],
};
