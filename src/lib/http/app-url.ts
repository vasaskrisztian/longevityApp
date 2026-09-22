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
