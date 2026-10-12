/**
 * Opt-in CORS for the JSON API, so the Expo web export (a different origin,
 * e.g. its own Railway service) can call `/api/*` with Bearer tokens.
 *
 * Disabled unless `CORS_ALLOWED_ORIGINS` is set (comma-separated exact
 * origins, e.g. `https://app.example.com`). There is no wildcard and no
 * `Access-Control-Allow-Credentials`: the mobile/web-export client
 * authenticates with an `Authorization: Bearer` header, never cookies, so
 * browsers never attach any session cookie to these requests.
 */
const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Authorization, Content-Type';

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o.length > 0 && o !== '*');
}

/** The origin to echo back, or null when CORS must not be granted. */
export function resolveCorsOrigin(origin: string | null, raw: string | undefined): string | null {
  if (!origin) return null;
  return parseAllowedOrigins(raw).includes(origin) ? origin : null;
}

export function corsHeaders(allowedOrigin: string, isPreflight: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowedOrigin,
    Vary: 'Origin',
  };
  if (isPreflight) {
    headers['Access-Control-Allow-Methods'] = ALLOWED_METHODS;
    headers['Access-Control-Allow-Headers'] = ALLOWED_HEADERS;
    headers['Access-Control-Max-Age'] = '600';
  }
  return headers;
}

/**
 * Every JSON API route is eligible — including `/api/auth/*` (register,
 * password reset, e-mail verification), which the Expo web export calls from
 * its own origin. Non-API paths (the retired UI pages) are not.
 */
export function isCorsEligiblePath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}
