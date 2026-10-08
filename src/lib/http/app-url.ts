/**
 * Builds an absolute URL for a redirect, preferring the app's public origin
 * (`APP_URL`) over the origin embedded in the incoming request.
 *
 * Railway (like most non-Vercel hosts) terminates TLS at its edge and
 * forwards to the container without rewriting the Host header to the public
 * domain, so `request.url`'s origin is the container's own internal
 * `localhost:PORT` — harmless for reading query params off the same
 * request, but a `Response.redirect(new URL(path, request.url))` built from
 * it sends the user's browser to an address that's only reachable from
 * inside the container (see auth.config.ts's `trustHost` comment for the
 * same root cause hitting Auth.js). `APP_URL` is the one source of truth
 * for the public origin; this falls back to `requestUrl` so redirects still
 * work locally (dev, tests) where `APP_URL` may be unset.
 */
export function resolveAppUrl(path: string, requestUrl: string): URL {
  return new URL(path, process.env.APP_URL || requestUrl);
}

/**
 * Public origin of the Expo web app, for links emailed to users that should
 * open the single (Expo) frontend — e.g. the password-reset link
 * (`/reset-password?token=…` exists in both frontends). `WEB_APP_URL` is
 * opt-in: unset, links keep pointing at `APP_URL` (the Next.js UI), so
 * nothing changes until the Expo web service is switched on.
 */
export function resolveWebAppOrigin(): string {
  const raw = process.env.WEB_APP_URL || process.env.APP_URL || '';
  return raw.replace(/\/+$/, '');
}
