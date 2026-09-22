# Phase 4 — Oura OAuth

ARCHITECTURE.md §12's phased delivery plan puts Phase 4 as: *"Oura OAuth:
authorize, callback, credential storage, rotating-refresh handling,
revoke."* This phase makes `provider-registry.ts`'s empty seam (built in
Phase 3) real: the first `WearableProviderAdapter` implementation, the first
actual OAuth2 Authorization Code + PKCE exchange, and the first time
`credential-vault.service.ts` is called with real tokens instead of a test
double. Ingestion (the Oura API client for daily/heartrate/workout data,
mappers, raw storage) stays Phase 5; nothing in this phase fetches or stores
any health data.

## Implemented

- **PKCE (`lib/auth/pkce.ts`)** — `generatePkcePair()` per RFC 7636:
  `randomBytes(32).toString('base64url')` verifier, S256
  (`sha256(verifier)`, base64url) challenge.
- **OAuth state (`modules/wearable/services/oauth-state.service.ts`)** —
  `createOAuthState` mints a single-use, 10-minute-default-TTL `state` bound
  to the caller's `userId` and stores it (with the PKCE verifier) in
  `OAuthState`. `consumeOAuthState` is an atomic `updateMany` CAS
  (`where: {state, provider, usedAt: null, expiresAt: {gt: now}}`) — two
  callers racing to present the same `state` can never both succeed; the
  loser's `updateMany` matches zero rows. State is stored unhashed
  (unlike email-delivered tokens): it round-trips through the browser in
  seconds, not days, so the threat model is different.
- **Advisory credential lock** (`modules/wearable/domain/credential-lock.types.ts`
  + `modules/wearable/services/credential-lock.ts`) — `PrismaCredentialLock`
  implements ARCHITECTURE.md §6.1's `CredentialLock` interface using
  `EncryptedCredential.refreshLockedAt`/`refreshLockedBy` via atomic
  `updateMany` calls, rather than a raw-SQL `SELECT ... FOR UPDATE`
  transaction. A lock older than 30s is treated as an abandoned (crashed)
  holder and can be stolen. Chosen over raw SQL because `@prisma/client`'s
  stub in this sandbox doesn't expose a typed `Prisma.sql` tag to build
  against safely (see Known limitations), and because the real
  multi-connection concurrency *test* against a live Postgres instance is
  explicitly **Phase 9**'s deliverable per the phase table — this phase only
  has to ship a correct locking implementation, which the `updateMany`
  approach's atomicity guarantees regardless of which flavor of lock backs
  it.
- **Rotating refresh flow** (`modules/wearable/services/refresh-credential.service.ts`)
  — `ensureFreshAccessToken(connectionId, adapter, options?)` is the
  function Phase 5/6/7's ingestion code will call to get a guaranteed-fresh
  access token. Implements all four of ARCHITECTURE.md §6.2's guarantees:
  acquires the advisory lock before calling the provider (only one worker
  reaches the token endpoint), re-checks freshness *inside* the lock so a
  second worker that was waiting never re-refreshes a token another worker
  already rotated, persists the new tokens via `rotateCredential`'s
  optimistic-concurrency `updateMany` (atomic apply-or-noop), and never
  caches a token beyond the single call that needed it. On a rejected
  refresh, marks the connection `AUTH_REQUIRED` and rethrows rather than
  silently retrying with a token that may already be dead. Accepts an
  injectable `CredentialLock` (and retry-count/delay overrides) specifically
  so tests can exercise every branch without a real database.
- **`credential-vault.service.ts` — `rotateCredential`** — the only function
  anywhere allowed to bump `EncryptedCredential.refreshVersion`; an
  optimistic-concurrency `updateMany` keyed on `{connectionId,
  refreshVersion: expectedVersion}` that returns `false` instead of throwing
  when the CAS doesn't match, so the caller (which already holds the
  advisory lock) can decide how to react.
- **`wearable.service.ts` additions** — `upsertConnectionAsConnected`
  (reuses an existing row for `(userId, provider)` if one exists, so a
  reconnect-after-disconnect doesn't orphan the old row or churn
  `EncryptedCredential`'s FK), `markConnectionDisconnected`,
  `markConnectionAuthRequired`.
- **`sync-job.service.ts`** — `enqueueInitialSyncJob` inserts a `QUEUED`
  `SyncJob` row. Bookkeeping only, per ARCHITECTURE.md §5 ("the callback
  does not wait for the historical import; it enqueues the job and
  redirects immediately") — nothing consumes this row yet; the actual
  worker is Phase 7's scope.
- **`modules/wearable/providers/oura/`** — the first real
  `WearableProviderAdapter`:
  - `oura-config.ts` — endpoint URLs, `OURA_REQUESTED_SCOPES`
    (`personal, daily, heartrate, workout, spo2Daily`), `isOuraMockMode()`,
    `loadOuraCredentials()` (throws `ProviderNotConfiguredError` if any of
    `OURA_CLIENT_ID`/`OURA_CLIENT_SECRET`/`OURA_REDIRECT_URI` is missing).
  - `oura-auth.ts` — the real `fetch`-based token exchange/refresh/revoke
    calls. `revokeOuraTokens` is best-effort by design: it never throws
    (network failure or a non-2xx response both just log a warning and
    return), because a provider outage must never block the user from
    disconnecting locally.
  - `oura-mock.ts` — zero-network mock implementations gated by
    `OURA_MOCK_MODE=true`, each generating a fresh random-suffixed token
    per call (not a module-level counter) so parallel tests stay
    independent.
  - `oura-provider.ts` — `OuraProvider implements WearableProviderAdapter`,
    branching on `isOuraMockMode()` per call (checked live, not baked into
    the constructor, so both branches are testable against the same
    instance); `getOuraProvider()` is a lazy singleton that also
    self-registers into `provider-registry.ts` on first construction —
    `getProvider('OURA')` now returns a real adapter instead of
    `undefined`.
- **`GET /api/integrations/oura/connect`** — generates PKCE, persists
  `OAuthState`, redirects to Oura's (or the mock) authorize URL.
- **`GET /api/integrations/oura/callback`** — validates the single-use
  state (400 if invalid/expired/reused), a defense-in-depth check that the
  state belongs to the *current* session (not just that it's valid in
  isolation — otherwise a captured state could be replayed by a different
  user within its 10-minute TTL), exchanges the code for tokens, stores the
  connection + encrypted credential, writes an `AuditLog(USER_CONNECT_OURA)`
  entry, enqueues the initial sync job, and redirects to `/profile/devices`
  (with `?oura_error=denied|exchange_failed` on the two recoverable failure
  paths).
- **`POST /api/integrations/oura/disconnect`** — no `[id]` param; the
  connection is resolved from `(the caller's own userId, OURA)`, matching
  Phase 3's IDOR-immune pattern, so there's no client-suppliable id for an
  IDOR test to probe. Best-effort provider-side revoke (defensively
  double-wrapped even though `oura-auth.ts` already swallows its own
  failures), then local delete + mark-disconnected + audit log, always
  ending in a 303 redirect (so a plain HTML form POST's browser follow-up
  is a GET).
- **`/profile/devices`** — Connect/Reconnect and Disconnect are now real
  `<a href>`/`<form method="POST">` elements instead of disabled
  placeholders; renders an error banner for `?oura_error=denied|
  exchange_failed`.
- **Middleware check (no change needed)**: `middleware.ts`'s `config.matcher`
  covers page routes only (`/dashboard`, `/trends`, `/profile`, `/admin`,
  `/onboarding`) — no `/api/**` prefix is in it, and that's consistent
  across every existing API route (`/api/wearables`, `/api/goals`,
  `/api/supplements`, `/api/profile`), all of which rely solely on
  `requireAuthenticatedUser()` inside the handler as the real authorization
  boundary (the middleware's own doc comment says as much: "this is NOT the
  authorization boundary"). The new Oura routes correctly follow the same
  pattern; there was no missing-prefix bug analogous to Phase 2's
  `/onboarding` fix.

## Design decision revised before implementation: `WearableProviderAdapter`'s OAuth methods

Phase 3's `buildAuthorizationRequest(params: {userId, redirectUri})`
returned the *entire* `AuthorizationRequest`, including `state` — which
would have made each provider adapter responsible for generating and
persisting OAuth state, a generic concern that belongs in
`oauth-state.service.ts`/`pkce.ts`, not in provider-specific code. Caught
during this phase's design (before writing `oura-provider.ts`) and revised
to `getRedirectUri()` + `buildAuthorizationUrl({state, codeChallenge})` +
`exchangeAuthorizationCode({code, codeVerifier})` — the adapter now only
builds a URL and exchanges/refreshes/revokes tokens; nothing else needs to
know the redirect URI is passed in twice. Documented as a design
refinement, not a breaking change: nothing had implemented the Phase-3
shape yet, only the registry test's throwaway fake adapter, which was
updated in lockstep.

## Bug fixed: `no-restricted-imports` didn't anticipate the Oura routes themselves needing Oura types

After writing all three route files under `src/app/api/integrations/oura/`,
`npx eslint .` failed with three "Oura-specific types/clients must not be
imported outside modules/wearable/providers/oura" errors — the Phase-3
oura-import restriction correctly blocks everything outside
`providers/oura/*`, but didn't anticipate that the Oura-specific *routes*
(whose entire purpose is bridging generic OAuth orchestration to the
concrete Oura adapter via `getOuraProvider()`) are legitimately allowed to
know about Oura. Fixed with a targeted `.eslintrc.json` override scoped to
`src/app/api/integrations/oura/**` that keeps only the encryption
restriction for those files. Verified both directions: a scratch probe
outside that path still fails; the three route files pass; `npx eslint .`
is clean.

A second, same-shaped gap surfaced while writing this phase's own tests:
`oura-config.test.ts` and `oura-mock.test.ts` need to import
`providers/oura/oura-config`/`oura-mock` directly (there's no adapter
interface to go through when the whole point is unit-testing that exact
module), which the `tests/**` override — deliberately *re-enabling* the
oura-restriction inside tests — correctly flagged. Fixed the same way, with
a narrower override for `tests/unit/oura-*.test.ts` that turns the
restriction off only for files whose name says they test Oura internals
directly; `api-oura-*.route.test.ts` files (which reach the adapter only
through a mocked `getOuraProvider()`, never a direct type import) are
unaffected and remain restricted. Verified with the same probe-file method
as above.

## Cleanup: an unused, never-thrown error class

`modules/wearable/domain/errors.ts` (written speculatively before the
routes) declared `OAuthConsentDeniedError` for "the user declined the
provider's consent screen" — but the actual `callback/route.ts`
implementation ended up handling that case by checking the `?error=`
query param directly and redirecting, never constructing or throwing this
class. Left untested, it would have been dead, unverifiable code sitting
in the public domain-errors module. Removed it rather than write a test for
something the real code path never exercises.

## Tests

- **86 new tests, 370 total across 46 files, all passing**
  (`npm run test:coverage`) — the full Phase 1–3 suite re-run unchanged
  alongside everything below:
  - `pkce.test.ts` (4) — verifier length/uniqueness, S256 correctness,
    URL-safety.
  - `oauth-state.service.test.ts` (7) — TTL defaults/overrides, the exact
    CAS `where` clause, a simulated two-concurrent-callbacks race (only the
    first `updateMany` call "wins"), provider mismatch, and the
    unreachable-in-practice re-read-returns-null branch.
  - `oura-config.test.ts` (6), `oura-mock.test.ts` (4), `oura-auth.test.ts`
    (9), `oura-provider.test.ts` (11) — config loading/env gating, mock
    response shape/uniqueness, real `fetch`-based exchange/refresh/revoke
    (request bodies, non-2xx → `ProviderTokenExchangeError`, revoke's
    three never-throws branches), and the adapter's mock-vs-real branching
    plus the singleton/self-registration behavior of `getOuraProvider()`.
  - `credential-lock.test.ts` (7) — the atomic-acquire CAS (including a
    simulated two-callers-race and the stale-lock-can-be-stolen `WHERE`
    clause), holder-guarded release, and that release is a safe no-op when
    the lock was already stolen.
  - `refresh-credential.service.test.ts` (12) — every branch: fast path (no
    refresh needed, lock never touched), the default-lock construction path
    (`options.lock ?? new PrismaCredentialLock()`), lock-acquired-then-
    refresh-succeeds, the lock retry loop with a real positive delay,
    another-worker-already-refreshed-while-waiting, refresh-fails-marks-
    AUTH_REQUIRED-and-rethrows, lock-acquisition-times-out, the credential
    disappearing between the fast-path read and the lock, and a CAS
    conflict on rotate.
  - `sync-job.service.test.ts` (1) — the exact `SyncJob` create payload.
  - New `describe` blocks added to the existing `wearable.service.test.ts`
    (create-vs-update branches of `upsertConnectionAsConnected`, scoped-
    lookup assertion, `markConnectionDisconnected`,
    `markConnectionAuthRequired`) and `credential-vault.service.test.ts`
    (`rotateCredential`'s never-plaintext assertion, successful CAS +
    version increment, and the false-on-conflict path), consistent with
    those files' existing conventions rather than duplicating them in new
    files.
  - `api-oura-connect.route.test.ts` (4), `api-oura-callback.route.test.ts`
    (9), `api-oura-disconnect.route.test.ts` (7) — unauthenticated → 401 on
    all three; connect's 503-when-unconfigured and unexpected-error-
    rethrow branches; callback's consent-denied redirect, missing
    code/state, invalid/expired state, the unexpected-error rethrow, the
    state-user-mismatch defense-in-depth check, missing PKCE verifier,
    exchange-failure redirect, and the full success path asserting
    `upsertConnectionAsConnected`/`saveCredential`/`auditLog.create`/
    `enqueueInitialSyncJob` are all called with the right arguments;
    disconnect's no-op-when-never-connected/already-disconnected paths, the
    IDOR-immune `(userId, provider)`-only lookup, the full revoke-delete-
    mark-audit success path, surviving an unexpected throw from the
    provider's revoke call, and skipping revoke (but still marking
    disconnected) when no local credential row exists.
- **100% statement/branch/function coverage on every Phase 4 module** —
  every new service, provider file, and route handler, with no
  exceptions. Two coverage gaps were closed by adding targeted tests
  rather than excluding lines, matching the standard set in Phase 1–3: the
  `options.lock` default-construction branch in
  `refresh-credential.service.ts`, and the `throw error` (unexpected,
  non-domain-error) rethrow branches in both the connect and callback
  routes.
- `npx tsc --noEmit`: clean except the same pre-existing `@prisma/client`
  stub-typing gap documented since Phase 1. One real, pre-existing-in-this-
  session bug caught by this phase's first `tsc` run: `oura-auth.test.ts`
  destructured `fetchMock.mock.calls[0]` (typed `T[] | undefined` under
  `noUncheckedIndexedAccess`) without a non-null assertion in three places
  — fixed with the same `mock.calls[0]!` pattern already used in
  `auth.service.test.ts`/`credential-vault.service.test.ts`, rather than
  weakening `noUncheckedIndexedAccess`.
- `npx eslint .`: clean, including both `no-restricted-imports` override
  additions described above (each verified in both directions with a
  scratch probe file).
- **Ran the app live** (`npm run dev` with `OURA_MOCK_MODE=true` and the
  other Oura env vars set): all three new routes
  (`connect`/`callback`/`disconnect`) 500 with the identical, already-
  documented sandbox limitation as every other authenticated route since
  Phase 1 — `requireAuthenticatedUser()` transitively imports
  `lib/db/prisma.ts`, and `prisma generate` cannot run here (`binaries.prisma.sh`
  still returns 403 on the checksum fetch, confirmed again this phase).
  This is not a Phase-4 regression or defect; it's the same class of gap
  documented every phase since Phase 1, and the mocked-Prisma unit tests
  above are what actually prove this phase's logic.

## Known limitations

- Same Prisma-engine sandbox limitation as Phase 1–3; nothing new
  introduced by Phase 4.
- The real multi-connection refresh-race integration test (two concurrent
  processes actually racing `ensureFreshAccessToken` against a live
  Postgres instance) is explicitly **Phase 9**'s deliverable per
  ARCHITECTURE.md §12's phase table. This phase ships a correct locking
  implementation and proves every branch of its logic against mocks; it
  does not — and per the phase table, should not yet — prove the real
  concurrency guarantee against a live database.
- `PrismaCredentialLock` is an application-level advisory lock (atomic
  `updateMany` CAS on `EncryptedCredential.refreshLockedAt`/
  `refreshLockedBy`), not a raw-SQL `SELECT ... FOR UPDATE` transaction.
  ARCHITECTURE.md §6.1 explicitly allows either — "a distributed Redis lock
  is an acceptable alternative if the worker fleet needs it — the interface
  is the same either way" — so a future swap to Redis (or to raw SQL, if
  the Prisma stub gap is ever resolved) only touches
  `credential-lock.ts`'s implementation, never `ensureFreshAccessToken`'s
  callers.
- `OURA_MOCK_MODE=true` lets the whole connect→callback round trip run with
  zero network calls, including a `connect` URL that points at the app's
  own real callback (marked `?mock=1`) rather than a nonexistent external
  mock server — but nothing in this sandbox can exercise that live end to
  end (see Tests, above) without a working Prisma client.

## Next phase

Phase 5 — Ingestion: the real Oura API client (daily activity/sleep/
readiness, heartrate, workout, SpO2 endpoints), response mappers into the
raw-storage tables, and the first caller of this phase's
`ensureFreshAccessToken` for a token that's actually about to be used
against a real (or mocked) provider API rather than just minted and stored.
