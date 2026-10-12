/**
 * The Next.js pages (login, dashboard, profile, admin, ...) were retired: the
 * Expo web app is the only UI. Old bookmarks, old e-mails (invitations, password
 * resets) and links typed by habit still point at this backend's origin, so
 * every former UI path is forwarded to the same path of the Expo web app,
 * query string included (`/reset-password?token=…` keeps working). The Expo
 * app has its own redirects for its older paths (`/profile/*`, `/devices`, `/trends`).
 */

const FORWARDED_PREFIXES = [
  '/login',
  '/register',
  '/reset-password',
  '/invite',
  '/creators',
  '/profile',
  '/admin',
  '/onboarding',
  '/notifications',
  '/trends',
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** True for the paths that used to be Next.js pages (never for `/api/*`). */
export function isLegacyUiPath(pathname: string): boolean {
  if (pathname === '/' || matchesPrefix(pathname, '/dashboard')) return true;
  return FORWARDED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/**
 * Where a retired UI path now lives, or null when the request should not be
 * redirected (not a UI path, or `webAppUrl` — the WEB_APP_URL env var — is not
 * set / is this very origin, which would loop).
 */
export function legacyUiRedirectTarget(
  pathname: string,
  search: string,
  webAppUrl: string | undefined,
  requestOrigin: string,
): string | null {
  if (!isLegacyUiPath(pathname)) return null;
  const origin = (webAppUrl ?? '').trim().replace(/\/+$/, '');
  if (!origin || origin === requestOrigin.replace(/\/+$/, '')) return null;

  // The old dashboard is the Today tab, the root of the Expo app.
  const path = matchesPrefix(pathname, '/dashboard') ? '/' : pathname;
  return `${origin}${path}${search}`;
}
