# Hosting the Expo web export (second Railway service)

Step 4 of the single-frontend roadmap: the Expo app's web export is served in
production next to the Next.js backend, on **its own URL first**. The old
Next.js UI stays untouched until TestFlight QA confirms parity.

## What was added

- `mobile/server/web-server.js` — dependency-free static server for `dist/`:
  clean URLs (`/login` -> `login.html`), dynamic segments (`/creators/abc` ->
  `creators/[id].html`, any depth), real 404 with Expo's `+not-found` page,
  `/healthz`, immutable caching for hashed assets, `no-cache` for HTML,
  security headers, path-traversal guard, GET/HEAD only.
- `mobile/Dockerfile` — build stage (`npm ci` + `expo export --platform web`),
  runtime stage with just `dist/` + the server. `mobile/railway.json` — Dockerfile
  builder, health check `/healthz`. `mobile/.dockerignore`.
- Backend CORS (opt-in): `src/lib/http/cors.ts` + `src/middleware.ts`. The web
  export calls the backend cross-origin (`API_BASE_URL` in `mobile/src/config/env.ts`)
  with `Authorization: Bearer`. `CORS_ALLOWED_ORIGINS` (comma-separated exact
  origins) enables it; unset = nothing changes. No wildcard, no
  `Allow-Credentials` (cookies are never used by this client), `/api/auth/*`
  (NextAuth) is excluded. Preflights from listed origins get 204.

## One-time setup (Railway dashboard)

1. In project `calm-miracle` -> **New** -> **GitHub Repo** -> `vasaskrisztian/longevityApp`;
   name the service e.g. `longevity-web`.
2. Service **Settings -> Source -> Root Directory = `mobile`** (so it picks up
   `mobile/Dockerfile` and `mobile/railway.json`, not the backend's).
3. **Settings -> Networking -> Generate Domain** (note the URL, e.g.
   `https://longevity-web-production.up.railway.app`).
4. On the existing **backend** service (`longevityApp`) add the variable
   `CORS_ALLOWED_ORIGINS=https://<the web service domain>` and redeploy.
5. Open the web URL, sign in. (If sign-in fails with a network error in the
   browser console, the origin in step 4 does not match exactly — scheme + host,
   no trailing slash needed, no path.)

## Verified in the sandbox

Production server against a fresh export: every route above returns the shell
with correct status (`/nope` -> 404, traversal -> 404/400, missing asset -> 404,
POST -> 405); Playwright regression (auth screens, creator teaser, safe-area)
passes when served by it. Not verifiable here: the Railway build itself and the
live CORS handshake (sandbox cannot reach Railway) — step 5 is that check.

## Later (end state)

Point the main domain's UI routes (`/login`, `/register`, `/reset-password`,
`/creators/*`) at this service (or move to a single domain that serves Expo and
proxies `/api/*` to Next.js), add universal links for emailed reset links, then
retire the Next.js UI routes.
