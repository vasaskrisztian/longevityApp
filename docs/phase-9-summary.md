# Phase 9 — Security hardening

ARCHITECTURE.md §12's phased delivery plan puts Phase 9 as: *"Security
hardening: rate limiting, IDOR tests, refresh-race test, audit log
completeness."* Unlike every phase before it, this one adds almost no new
features — it audits what Phases 1–8 already built against §10's threat
table and closes the gaps it found, then adds the dedicated tests §10.6 and
§10.7 call "mandatory" by name.

## Audit findings and what was fixed

- **`POST /api/integrations/oura/connect` had no rate limiting** — §4.3
  explicitly lists this endpoint alongside `/login`, `/register`,
  `/password-reset`, and the sync endpoint ("Rate limiting on ... all
  auth and OAuth-connect endpoints"), but it was missed when Phase 4 built
  the OAuth flow; login/register/password-reset already had it since Phase
  1. Fixed: `checkRateLimit('oura-connect', userId, AUTH_RATE_LIMIT)` (5
  attempts / 15 min, the existing constant), keyed by the caller's own user
  id rather than IP — this is an authenticated endpoint, so per-user is the
  right scope (caps how many `OAuthState` rows / Oura-authorize redirects
  one account can generate, independent of how many other accounts share an
  IP) — returning 429 before any state/PKCE work happens.
- **Audit log writes were four separate hand-written
  `prisma.auditLog.create` calls** (admin.service.ts's two writers, the
  OAuth callback's `USER_CONNECT_OURA`, the disconnect route's
  `USER_DISCONNECT_OURA`) — all four were already correct, but §10 threat
  #15 also calls for "an explicit denylist of fields that must never appear
  in `metadata`," which existed only as a sentence in this doc, enforced
  nowhere in code. New: **`lib/audit/audit-log.service.ts`**'s
  `recordAuditLog()` — the one function every `AuditLog` write in the
  codebase now goes through. It checks every `metadata` key (case-
  insensitive substring match: `token`, `password`, `secret`, `ciphertext`,
  `authtag`, `credential`) and throws `UnsafeAuditMetadataError` — refusing
  the entire write, not silently stripping the field — if any key looks
  like a secret. All four existing call sites were refactored to use it
  (behavior unchanged; their existing tests were updated to mock the new
  module instead of asserting on raw `prisma.auditLog.create` calls).
- **Everything else §10 lists was already correctly implemented** and
  needed no code change, only verification: `requireOwnResourceOrAdmin`/
  `requireAdmin` gate every user-scoped and admin route (threat #1);
  `EncryptedCredential` is 1:1-locked behind `modules/wearable/*` and never
  selected by any admin query (threats #3, #10); `OAuthState` is single-use
  with a short TTL (threats #4, #13); password reset gives an identical
  response regardless of account existence (threat #7); every sync-path
  write is a keyed upsert (threat #8); Zod validates every endpoint
  server-side (threat #9); `role` is never accepted from a request body
  anywhere in the codebase (threat #11); Oura scopes are minimal and
  granted-scopes are stored and checked (threat #12).

## New tests

- **17 new tests, 572 total across 75 files, all passing**
  (`npm run test:coverage`):
  - **`tests/integration/idor-bola.test.ts`** (2 tests, new) — the single
    canonical reproduction of §10.6's exact three-line scenario, quoted
    directly in the file's own header comment: as User A, `GET
    /api/admin/users/{UserB.id}/dashboard` → 403 with UserB's data never
    read or audited; as User A, `GET /api/dashboard?userId={UserB.id}` →
    the query param is provably never read (the route handler takes no
    arguments at all); as Admin, the same admin route → 200 + an
    `ADMIN_VIEW_USER` audit write scoped to (admin, UserB). §10.6's own
    route name (`GET /api/admin/users/:id`) doesn't literally exist in
    §8.2's table — this file targets `GET /api/admin/users/:id/dashboard`,
    the same interpretation Phase 8's own route test already documented.
  - **`tests/integration/refresh-token-race.test.ts`** (1 test, new) —
    §10.7's mandatory concurrency test. Unlike
    `refresh-credential.service.test.ts`'s existing unit tests (which
    script each call's mock return value ahead of time, assuming a fixed
    order), this test runs two real, concurrent `ensureFreshAccessToken`
    calls via `Promise.all` against a shared, mutable in-memory credential
    store and a real single-winner lock (reimplementing
    `PrismaCredentialLock`'s atomicity guarantee in memory, since this
    sandbox has no live Postgres to race against for real — the same
    documented constraint as every prior phase). An artificial delay inside
    the fake adapter's `refreshAccessToken` forces genuine interleaving
    rather than letting the event loop resolve both calls' synchronous
    portions before either awaits. Asserts all three guarantees at once:
    the provider is called exactly once, both workers resolve to the
    identical new token, `refreshVersion` increments exactly once, and
    `markConnectionAuthRequired` is never called for the "loser."
  - **`audit-log.service.test.ts`** (9 tests, new) — the default no-metadata
    write shape, safe metadata passed through unchanged, a null
    actor/target (system-initiated action), and a parametrized case over
    seven forbidden-looking key names (`accessToken`, `refresh_token`,
    `Password`, `clientSecret`, `ciphertext`, `authTag`, `credentialId`)
    each independently proven to throw and never reach `prisma.auditLog.create`,
    plus a case where only one of several metadata fields is unsafe.
  - Extended `api-oura-connect.route.test.ts` (+2) — the rate-limit call's
    exact key/scope/options, and a 429 that touches neither `OAuthState`
    nor the provider.
  - Updated `admin.service.test.ts`, `api-oura-callback.route.test.ts`,
    `api-oura-disconnect.route.test.ts` — now mock
    `@/lib/audit/audit-log.service` instead of asserting on raw
    `prisma.auditLog.create` calls, matching the refactor.
- **100% statement/branch/function coverage** on every new/changed file.
- `npx tsc --noEmit`: clean except the same pre-existing `@prisma/client`
  stub-typing gap documented since Phase 1.
- `npx eslint .`: clean.
- **Ran the app live** (`npm run dev` with a temporary `.env.local`, deleted
  afterward): `GET /api/health` (new in the CI/CD pass) returns
  `200 {"status":"ok"}`; `/dashboard` and `/admin` still 307-redirect
  unauthenticated visitors, unchanged; `GET /api/integrations/oura/connect`
  compiles and 500s with the identical, already-documented
  `@prisma/client did not initialize yet` error before even reaching the
  new rate-limit check — not a Phase 9 defect, the same sandbox limitation
  every authenticated route hits, since `requireAuthenticatedUser` pulls in
  `auth.ts`, which pulls in the Prisma client, at import time. No
  regressions observed on any previously-working route.

## Known limitations

- **No live Postgres/Redis in this sandbox** — the same limitation
  documented every phase. The refresh-race test's in-memory lock and
  credential store are a deliberate, documented stand-in for a real
  concurrent-Postgres test — see the test file's own header comment for the
  reasoning — not a claim that this has been run against real Postgres row
  locking.
- **Rate limiting is still the Phase 1 in-memory, per-instance store**
  (`lib/auth/rate-limit.ts`'s own comment has said since Phase 1: "fine for
  a single dev/staging instance but NOT sufficient once the app runs on
  multiple instances — swap the store for Redis before production
  multi-instance deployment"). Phase 9 added a missing call site
  (`oura-connect`) but did not change the underlying store — a genuinely
  multi-instance-safe rate limiter (Redis-backed) is follow-up work, not
  blocking for this MVP's single-instance deployment target (see
  `docs/ci-cd-setup.md`'s Railway setup, which runs one web instance).
- **No generic security-headers pass** (CSP, HSTS, X-Frame-Options,
  Permissions-Policy, etc.) — deliberately out of scope: ARCHITECTURE.md's
  Phase 9 line item names "rate limiting, IDOR tests, refresh-race test,
  audit log completeness" specifically, and §10's threat table doesn't list
  missing security headers as one of its 15 threats. Worth a follow-up pass
  before a public production launch, but not manufactured into this phase's
  scope.
- **`register/route.ts` has one pre-existing, unrelated branch-coverage gap**
  (`email.split('@')[1] ?? ''` on an email that has already passed Zod's
  email-format validation, so the `?? ''` fallback is defensive dead code)
  — noticed while reviewing this phase's coverage report, not introduced by
  it, and left alone as out of scope.

## Next phase

Phase 10 — MCP / AI-ready layer, deliberately last per ARCHITECTURE.md §9:
"only after Phase 1–9 work with MCP absent." Adds `HealthMcpGateway` and the
five read-only MCP tools (`get_user_daily_health`, `get_user_sleep_trend`,
`get_user_readiness_trend`, `get_user_activity_trend`,
`get_user_health_summary`), each bound to an already-authenticated context
exactly like `requireOwnResourceOrAdmin` — never a caller-supplied `userId`
— and never touching `lib/encryption` or the Oura provider directly. Once
Phase 10 ships, §13's MVP acceptance criteria are fully met.
