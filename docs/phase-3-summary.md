# Phase 3 — Wearable domain

## Scope note

ARCHITECTURE.md §12's phased delivery plan puts Phase 3 as: *"Wearable
domain: `WearableConnection`, provider interfaces, encrypted credential
storage."* The Oura OAuth2 authorization-code flow itself
(`/api/integrations/oura/connect|callback|disconnect`) is **Phase 4**, and
ingestion (the Oura API client, mappers, raw storage) is **Phase 5**. The
`docs/phase-2-summary.md` "Next phase" note previously described this phase
incorrectly (as the OAuth flow) — corrected there and confirmed here against
the authoritative table. Nothing in this phase performs a real OAuth
exchange or talks to Oura's API; it builds the seam Phase 4 plugs into.

## Implemented

- **Domain layer** (`modules/wearable/domain/`, zero I/O, zero framework
  imports, per ARCHITECTURE.md §2's layout rules):
  - `wearable-provider.types.ts` — `WearableProviderId` (an alias over
    Prisma's `WearableProvider` enum), `SUPPORTED_WEARABLE_PROVIDERS`
    (`['OURA']` — the schema also defines GARMIN/WHOOP/FITBIT/APPLE_HEALTH/
    SAMSUNG_HEALTH for future extensibility, but nothing implements an
    adapter for them yet, so they must never appear in a connection list),
    `isSupportedWearableProvider()`, the `OAuthTokenSet` and
    `AuthorizationRequest` plaintext-in-memory-only types, the
    `WearableProviderAdapter` interface (the contract Phase 4's OAuth
    methods and Phase 5's `fetchRawData` will implement), and the
    client-safe `ConnectionSummary` DTO (never includes anything from
    `EncryptedCredential`).
  - `provider-registry.ts` — an in-memory `Map<WearableProviderId,
    WearableProviderAdapter>` (`registerProvider`/`getProvider`/
    `getRegisteredProviderIds`). Nothing registers a provider yet — Phase 4
    will call `registerProvider(new OuraProvider(...))` once from a
    composition root. `getProvider('OURA')` correctly returns `undefined`
    today; that's the expected state of an unplugged seam, not a bug.
- **`modules/wearable/services/wearable.service.ts`** — connection
  listing/lookup, always scoped to a `userId` parameter (never a
  client-supplied id, same convention as `modules/supplements` and
  `modules/goals`): `listConnectionsForUser` returns exactly one entry per
  `SUPPORTED_WEARABLE_PROVIDERS`, synthesizing a `DISCONNECTED` summary for
  a provider the user has never attempted to connect, so callers never have
  to special-case "no row yet". `getConnectionForUserAndProvider` is the
  single-provider lookup the `/profile/devices` page uses.
- **`modules/wearable/services/credential-vault.service.ts`** — the first
  real usage of `EncryptionService` since it was built (and unit-tested) in
  Phase 1. `saveCredential`/`loadCredential`/`deleteCredential` are the only
  functions anywhere that touch `EncryptedCredential`; nothing outside this
  module ever sees ciphertext, and nothing outside this module ever needs
  to — Phase 4's OAuth callback and refresh flow will call these with
  plaintext tokens in and out. `saveCredential`'s `update` branch
  deliberately never touches `refreshVersion` — that field is only ever
  bumped by Phase 4's optimistic-concurrency-checked rotating-refresh
  update (ARCHITECTURE.md §6), never by a generic save.
- **`GET /api/wearables`** — lists the caller's own connections
  (`requireAuthenticatedUser()` → `listConnectionsForUser`). No `[id]`
  route exists in this phase: a wearable connection is only ever looked up
  by `(userId, provider)`, both under the server's control, so there's no
  caller-suppliable id for an IDOR test to probe (unlike supplements/goals,
  which do have that surface).
- **`/profile/devices`** — the Phase 1 placeholder queried
  `prisma.wearableConnection` directly; now goes through
  `getConnectionForUserAndProvider` (ARCHITECTURE.md §2: "no business logic
  in `app/**`"), and renders all four `WearableConnectionStatus` values
  (`CONNECTED`/`DISCONNECTED`/`AUTH_REQUIRED`/`ERROR`) with a status badge
  and status-appropriate copy, instead of only handling the connected/not
  binary. The Connect/Sync/Disconnect buttons stay disabled with
  "ships in Phase 4/5" tooltips — unchanged in spirit from Phase 1, since
  there is still no real OAuth flow to wire them to.

## Bug fixed: `no-restricted-imports`'s encryption-service restriction was dead code

While wiring `credential-vault.service.ts` — the first file ever to import
`lib/encryption/encryption.service` from outside a test — ESLint raised no
error at all, which was wrong: `.eslintrc.json`'s comment says "Only
modules/wearable/* and lib/auth/* may import the encryption service
directly," implying everywhere else should be blocked. Root cause: the rule
was written as `{ group: ["*/lib/encryption/*"], importNames: ["*"] }`.
`no-restricted-imports`'s `importNames` restricts specific *named* imports
literally listed in the array — `"*"` is not a wildcard there, it's a
(nonexistent) import literally named `*`, so the pattern never matched
anything, from any file, ever. Confirmed by probing: a scratch file outside
both allowed directories importing `getEncryptionService` passed lint
cleanly before the fix.

Fixed by removing the broken `importNames` key (so the base rule now
correctly blocks `lib/encryption/*` imports from anywhere) and adding an
`overrides` block scoping `src/modules/wearable/**`, `src/lib/auth/**` and
`tests/**` to a narrower version of the rule that keeps only the
oura-import restriction. Verified all three ways: an import from outside
the allowed paths now fails lint with the intended message; the same import
from inside `modules/wearable/services` passes; and the existing
`tests/unit/encryption.test.ts` (which legitimately needs direct access to
test the service) still passes now that `tests/**` is included in the
override. This was a real, previously-unenforced architectural guardrail —
not something Phase 1–2 could have caught, since `EncryptionService` had no
callers outside its own test until this phase.

## Tests

- **27 new tests, 284 total across 34 files, all passing**
  (`npm run test:coverage`) — the full Phase 1 + Phase 2 suite (257 tests)
  re-run unchanged alongside everything below:
  - `wearable-provider-registry.test.ts` (4) — register/get/overwrite/
    multiple-providers-tracked-independently, using a fake adapter (no real
    provider exists yet to test against).
  - `wearable-domain-types.test.ts` (4) — `isSupportedWearableProvider`
    true for Oura, false for schema-defined-but-unimplemented providers
    (Garmin, Whoop) and for arbitrary strings.
  - `wearable.service.test.ts` (8) — `listConnectionsForUser` is proven to
    query `where: { userId }` and nothing else (the userId-scoping
    guarantee, checked directly rather than inferred), synthesizes
    `DISCONNECTED` defaults, maps a real row correctly, defaults
    `grantedScopes` to `[]` when a row has none, and picks the newest row
    when a provider has been connected more than once (reconnect-after-
    revoke); `getConnectionForUserAndProvider` queries by both fields
    together.
  - `credential-vault.service.test.ts` (8) — deliberately does **not** mock
    `lib/encryption`, so this suite exercises the real AES-256-GCM service
    end to end: asserts the raw plaintext access/refresh tokens never
    appear anywhere in the serialized Prisma `upsert` call args, that the
    `create` branch sets `refreshVersion: 0` and populates all six
    cipher/iv/authTag fields, that the `update` branch omits
    `refreshVersion` entirely, that two saves produce different ciphertext
    (fresh IV each time), and a genuine save→load round trip proving
    `loadCredential` decrypts back to the exact plaintext that was saved —
    not just that some string made it into the mock.
  - `api-wearables.route.test.ts` (3) — 401 unauthenticated (service never
    called), 200 scoped to the caller's own id, 403 propagated the same way
    as any other authorization failure.
- 100% statement/branch/function coverage on every new module
  (`modules/wearable/domain/**`, `modules/wearable/services/**`,
  `app/api/wearables/route.ts`) — no exceptions, unlike Phase 1/2's one
  intentionally-unreachable branch.
- `npx tsc --noEmit`: clean except the same pre-existing `@prisma/client`
  stub-typing gap documented in Phase 1/2, now also covering
  `WearableProvider`/`WearableConnectionStatus` imported by the new domain
  types file. Two new test files needed `?.`/helper-function fixes for
  `noUncheckedIndexedAccess` (array-index-then-property-access patterns
  that hadn't come up in earlier test files) — not a Phase-3-specific
  issue, just the first time a test indexed into a mock's `.calls` array
  and then accessed a field on the result in the same expression.
- `npx eslint .`: clean, including the newly-fixed `no-restricted-imports`
  rule (see above).
- **Ran the app again** (Postgres + `npm run dev`, restarted fresh, +
  Playwright hitting the live server): `/login` re-screenshotted, byte-
  identical to Phase 1/2; unauthenticated `/profile/devices` redirects to
  `/login?callbackUrl=%2Fprofile%2Fdevices` (307, middleware-level,
  unchanged from Phase 1) — confirmed via both a raw `curl` status check
  and a Playwright navigation that lands on the login page. `/` (the root
  page) still 500s in this sandbox for the same reason documented below —
  pre-existing since Phase 1, not a regression (it calls `auth()` directly,
  outside middleware, before deciding where to redirect).
- **Known sandbox-only gap, not a code defect, unchanged from Phase 1/2**:
  `GET /api/wearables` 500s here instead of returning 401/200, for the
  identical reason every other authenticated API route does in this
  sandbox — `requireAuthenticatedUser()` transitively imports
  `lib/db/prisma.ts`, and `prisma generate` cannot run here (confirmed
  again this phase: `binaries.prisma.sh` still returns 403 on the checksum
  fetch). `credential-vault.service.ts`'s Prisma calls are equally untested
  live for the same reason — the mocked-Prisma unit tests above are what
  prove the logic; nothing here could be exercised end-to-end against a
  real generated client in this build sandbox, exactly as in Phase 1/2.

## Known limitations

- Same Prisma-engine sandbox limitation as Phase 1/2; nothing new
  introduced by Phase 3.
- No provider is registered in `provider-registry.ts` yet — by design.
  `getProvider('OURA')` returning `undefined` is correct until Phase 4
  builds `OuraProvider` and registers it.
- `deleteCredential` uses `deleteMany` (not `delete`) so it's idempotent
  when called on a connection that never had a credential row (e.g. one
  stuck in `AUTH_REQUIRED` before ever completing a token exchange) —
  intentional, not an oversight.
- The `/profile/devices` status badge only ever shows `DISCONNECTED` live
  in this sandbox (no way to seed a `CONNECTED`/`AUTH_REQUIRED`/`ERROR` row
  without a working Prisma client); the other three states are exercised
  only by `wearable.service.test.ts` and the page's own logic, not visually
  screenshotted.

## Next phase

Phase 4 — Oura OAuth: the Authorization Code + PKCE flow
(`/api/integrations/oura/{connect,callback,disconnect}`), `OAuthState`
single-use/short-TTL validation, the first real `WearableProviderAdapter`
implementation (`modules/wearable/providers/oura/oura-provider.ts` +
`oura-auth.ts`), wiring it into `provider-registry.ts`, calling
`credential-vault.service`'s `saveCredential`/`loadCredential` with real
tokens for the first time, the `AuditLog(USER_CONNECT_OURA)` entry, and the
rotating-refresh-token concurrency handling from ARCHITECTURE.md §6 (the
mandatory refresh-race test itself is explicitly Phase 9 per the phase
table, but the row-locking implementation it tests ships here).
