# Phase 1 — Foundation

## Implemented

- Next.js 14 App Router project, TypeScript strict mode, Tailwind CSS with
  the design tokens from ARCHITECTURE.md §37 (background, card, primary
  teal, etc.), Prisma wired to the schema from Phase 0.
- Auth.js (NextAuth v5) with a Credentials provider: Argon2id password
  hashing, JWT sessions carrying `id`/`role`, rate-limited login.
- Registration, email verification, password reset (request + confirm) —
  all server-validated with Zod, single-use hashed tokens, identical
  responses regardless of account existence (no user enumeration).
- Central authorization helpers: `requireAuthenticatedUser`, `requireAdmin`,
  `requireOwnResourceOrAdmin`, plus `toErrorResponse` for Route Handlers and
  redirect-based equivalents for Server Components (`page-guards.ts`).
- `EncryptionService` (AES-256-GCM) — ready for Phase 4's OAuth credentials,
  not yet wired to anything since there's nothing to encrypt yet.
- Structured logger with an allowlist-based redaction rule.
- Base UI shell: sidebar navigation (Dashboard/Trends/Profile/Lifestyle/
  Nutrition/Supplements/Goals/Devices, Admin for admins), shadcn-style
  primitives (Button/Card/Input/Label/Alert).
- Placeholder pages for every route in the architecture's URL map, each
  backed by a real `requireAuthenticatedUserForPage`/`requireAdmin` check —
  not just a hidden nav link — so the IDOR/BOLA discipline is already in
  place before there's real data to protect.
- `middleware.ts` (UX-layer redirect only, not the authorization boundary).
- `docker-compose.yml` (Postgres + Redis), `.env.example`, seed script
  (admin + demo user + 30 days of mock `DailyHealthMetric` rows).
- `lib/auth/errors.ts`: `UnauthenticatedError`/`ForbiddenError` extracted
  into their own dependency-free module (no Prisma, no Auth.js) so anything
  that just needs to recognize an auth error — tests, future MCP tool
  wrappers — never has to load the full Auth.js config to get them.
  `authorization.ts` re-exports both, so no import path elsewhere changed.

## Tests

- `npx tsc --noEmit`: clean, except for `@prisma/client` enum re-exports
  (`UserRole`, `UserStatus`, `DietType`, `ActivityLevel`, `GoalType`,
  `GoalStatus`) — these resolve once `prisma generate` runs with real
  network access to `binaries.prisma.sh`, which this build sandbox could not
  reach. Run `npm run prisma:generate` locally and re-run `npm run
  typecheck` to confirm zero errors.
- `npx eslint .`: clean (0 errors, 0 warnings), including the custom
  layering rule that forbids importing Oura-provider internals from outside
  `modules/wearable/providers/oura`.
- Actually ran the app: local PostgreSQL 16, `npm run dev`, and a headless
  Chromium (Playwright) hitting `/login`, `/register`, `/reset-password` and
  `/dashboard`. This caught a real bug — see below — and confirmed, after
  the fix, that `/login`, `/register`, `/reset-password` return 200, the
  register form's live Zod validation renders correctly, and an
  unauthenticated `/dashboard` request now 307-redirects to
  `/login?callbackUrl=%2Fdashboard` instead of 500ing.
- **Bug found and fixed**: `middleware.ts` imported the full Auth.js config
  (`lib/auth/auth.ts`), which pulls in `argon2` (a native Node addon, via the
  Credentials provider) and Prisma. Next.js middleware runs in the Edge
  runtime, which cannot bundle either — this broke every protected route
  (500, `UnhandledSchemeError: node:crypto`) and would have broken the same
  way in any real deployment, not just this sandbox. Fixed by splitting the
  config: `lib/auth/auth.config.ts` (Edge-safe: session/pages/callbacks
  only, empty `providers`) is what `middleware.ts` now uses; `lib/auth/
  auth.ts` extends it with the Credentials provider for Node-runtime use
  (Route Handlers, Server Components) only.
- **Unit test suite added and run** (`npm run test:coverage`, Vitest):
  **87 tests across 10 files, all passing**, with 100% statement/branch/
  function coverage on every testable module — `password.ts`, `tokens.ts`,
  `rate-limit.ts`, `errors.ts`, `authorization.ts`, `page-guards.ts`,
  `encryption.service.ts`, `logger.ts`, `auth.schemas.ts`, `utils.ts`, and
  `modules/auth/auth.service.ts` (registerUser, verifyEmail,
  requestPasswordReset, resetPassword — Prisma mocked, argon2/token hashing
  real). Two modules are intentionally 0%: `auth.ts` (the NextAuth config
  itself — its Credentials provider is exercised end-to-end by the live
  dev-server smoke test instead, not a unit test) and `lib/db/prisma.ts` (a
  one-line singleton wrapper). `authorization.ts`'s dependency on
  `@prisma/client`'s `UserRole` is mocked in tests for the same reason the
  typecheck exception above exists — the real enum isn't generated in this
  sandbox, but the mock exercises the exact same comparison logic.
- No integration/E2E tests yet — there's no CRUD or Oura integration to test
  against; the IDOR/BOLA and refresh-token-race suites from ARCHITECTURE.md
  §10.6/§10.7 start in Phase 3/9 once `WearableConnection` and admin
  user-scoped endpoints exist.

## Known limitations

- `prisma generate` could not run in the build sandbox (no route to
  `binaries.prisma.sh`); `@prisma/client` currently exposes an untyped
  fallback. Run `npm install && npm run prisma:generate` on a machine with
  normal internet access before `npm run dev`.
- The rate limiter (`lib/auth/rate-limit.ts`) is in-memory/per-instance —
  fine for one dev instance, must move to the already-provisioned Redis
  before a multi-instance deployment.
- Verification/reset emails are logged to the server console, not actually
  sent — no transactional email provider is wired up yet.
- No onboarding wizard, no Supplement/Goal CRUD, no Oura OAuth, no sync —
  all as planned for Phases 2–7.

## Next phase

Phase 2 — Profiles: the full onboarding wizard (personal info, exercise,
nutrition, supplements, goals) and their CRUD API routes, each gated by
`requireOwnResourceOrAdmin`.
