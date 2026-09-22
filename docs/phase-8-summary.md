# Phase 8 — Admin

ARCHITECTURE.md §12's phased delivery plan puts Phase 8 as: *"Admin: users
list, search/filters, user detail, manual sync."* §8 defines the admin
authorization model (a hard `UserRole.ADMIN` check on every request, never a
UI-only gate) and §8.2's endpoint table; §8.3 requires that admins are only
ever handed a `ConnectionSummary` — never `EncryptedCredential`. §10.6 names
the mandatory IDOR/BOLA test for this phase. This phase builds all of it on
top of Phase 7's already-working queue/worker pipeline: an admin-triggered
sync is the exact same `MANUAL` `SyncJob` a user's own "sync now" click
creates, just enqueued on the target user's behalf.

## Implemented

- **`lib/validation/admin.schemas.ts`** (new) — `AdminUserListQuerySchema`:
  optional free-text `q` (trimmed, max 200 chars), `ouraStatus` (`ALL` /
  `CONNECTED` / `AUTH_REQUIRED` / `ERROR` / `DISCONNECTED`, default `ALL`),
  `page`/`pageSize` (coerced integers, `pageSize` capped at 100) — the
  server-side source of truth for the admin list endpoint's query string,
  same convention as every other Zod schema in this project.
- **`modules/admin/admin.service.ts`** (new) — the module ARCHITECTURE.md §2
  reserves for admin business logic:
  - `listUsersForAdmin(query)` — searches `email` OR `profile.fullName`
    (case-insensitive `contains`), filters by Oura status, paginates, and
    maps each row to a flat `AdminUserListItem` (never the raw Prisma
    relations). The `DISCONNECTED` filter is the one non-obvious piece: it
    must match both "never attempted" (no `WearableConnection` row at all)
    and an explicit `DISCONNECTED` row, so it's built as `wearableConnections:
    { none: { provider: 'OURA', status: { in: [CONNECTED, AUTH_REQUIRED,
    ERROR] } } }` rather than a naive `some: { status: 'DISCONNECTED' }` —
    the same synthesized-DISCONNECTED convention `wearable.service.ts`'s
    `defaultSummary` already uses elsewhere in the app.
  - `getUserDetailForAdmin(targetUserId)` — assembles one user's account
    fields, their `ConnectionSummary` (via Phase 4/5's
    `getConnectionForUserAndProvider` — unchanged, so §8.3's
    never-expose-credentials guarantee is inherited for free), their
    dashboard snapshot (via Phase 6's `getTodaySnapshot`), and their 10 most
    recent `SyncJob` rows. Returns `null` if the user doesn't exist, so the
    route can 404 before ever calling the audit-log write.
  - `userExistsForAdmin(targetUserId)` — a dedicated, lightweight existence
    check. Needed because `getConnectionForUserAndProvider` synthesizes a
    `DISCONNECTED` `ConnectionSummary` even for a user id that doesn't exist
    at all, so it can't be reused to distinguish "no such user" (404) from
    "user exists but has never connected Oura" (200, disconnected state).
  - `recordAdminViewUser` / `recordAdminTriggerSync` — the two `AuditLog`
    writers §8.2 requires, each a one-line `prisma.auditLog.create` with a
    fixed `action` string (`ADMIN_VIEW_USER` / `ADMIN_TRIGGER_SYNC`).
- **`GET /api/admin/users`** (new) — `requireAdmin()`, parses the query
  string through `AdminUserListQuerySchema` (400 on an invalid `ouraStatus`
  or out-of-range page/pageSize), returns `listUsersForAdmin`'s result
  as-is. Read-only and not individually audited, matching §8.2's table (only
  the detail view and the sync trigger are audited — listing isn't a
  per-user data access).
- **`GET /api/admin/users/:id/dashboard`** (new) — `requireAdmin()`,
  `getUserDetailForAdmin(id)` (404 if `null`), `recordAdminViewUser(admin.id,
  id)`, 200 with the detail. This is the concrete route this phase treats as
  authoritative for §10.6's IDOR/BOLA test — §10.6's own prose shorthand
  (`GET /api/admin/users/{UserB.id}`) doesn't match any route §8.2 actually
  defines, so the test targets the one endpoint that both returns
  per-user data and writes the audited action.
- **`POST /api/admin/users/:id/sync`** (new) — `requireAdmin()`, 404 if the
  target user doesn't exist (`userExistsForAdmin`), rate-limited via the
  existing `checkRateLimit('manual-sync', targetUserId,
  MANUAL_SYNC_RATE_LIMIT)` — **keyed by the target user's id, not the
  admin's**. This is deliberate: the 1-per-5-minutes budget protects Oura's
  API for one connection, regardless of who clicks the button, so it's the
  same budget an admin-triggered sync and that user's own "sync now" click
  share. 409 if the connection isn't `CONNECTED`. On success: reuses Phase
  7's `enqueueManualSyncJob` + `enqueueSyncJobToQueue('MANUAL', jobId)`
  unchanged, writes `recordAdminTriggerSync`, and returns 202 + `{jobId}` —
  never blocking on the sync itself, identical in shape to the user-facing
  endpoint.
- **`app/admin/page.tsx`** (rewritten) — kept the existing KPI cards, added a
  server-side `listUsersForAdmin` call for the first unfiltered page, and
  replaced the placeholder "Users" card with `<AdminUsersTable initial={...}
  />`.
- **`app/admin/admin-users-table.tsx`** (new, client) — searchable
  (debounced 300ms), filterable (Oura status), paginated user table. Follows
  Phase 6's `trend-charts.tsx` client-fetch pattern exactly: `AbortController`
  per request, loading/error state, re-fetches `/api/admin/users` on any
  filter/page change while skipping the redundant first fetch (the
  server-rendered `initial` prop already reflects the default query). Each
  row's name links to `/admin/users/:id`.
- **`app/admin/users/:id/page.tsx`** (rewritten) — replaced the previous
  direct `prisma.user.findUnique` + raw `prisma.auditLog.create` with
  `getUserDetailForAdmin` + `recordAdminViewUser`; kept the "ADMIN VIEW —
  Viewing user: {name}" banner; added real connection-status display
  (reusing the same status labels/badge colors as the user-facing
  `/profile/devices` page for consistency), today's (or most recent)
  dashboard snapshot, a recent-sync-jobs table, and the new
  `TriggerSyncButton`.
- **`app/admin/users/:id/trigger-sync-button.tsx`** (new, client) — POSTs to
  the sync endpoint and renders the 202/429/409/error outcome inline
  (success, "already triggered recently," "not connected," or a generic
  error) — no page reload, matching the click-and-inline-feedback pattern
  used elsewhere (e.g. `goals-manager.tsx`).

## Tests

- **33 new tests, 554 total across 69 files, all passing**
  (`npm run test:coverage`):
  - `admin.service.test.ts` (16) — `listUsersForAdmin`'s where-clause
    construction for no filters, the search OR-clause, the `CONNECTED`
    filter, the `DISCONNECTED` none-clause (covering both "never connected"
    and "explicitly disconnected"), pagination skip/take, connection
    mapping (present and absent), missing-profile default, and
    total/page/pageSize passthrough; `getUserDetailForAdmin`'s
    null-on-missing-user short-circuit (never calls the connection/snapshot/
    sync-job lookups), full assembly, and missing-profile default;
    `userExistsForAdmin`'s true/false cases; the exact `AuditLog` payload
    each of `recordAdminViewUser`/`recordAdminTriggerSync` writes.
  - `api-admin-users.route.test.ts` (6) — 401/403 propagation (service never
    called), default query params, parsed query params, 400 on an invalid
    `ouraStatus`, 200 with the service's result as the body.
  - `api-admin-user-dashboard.route.test.ts` (4) — explicitly written
    against §10.6's mandatory case: 403 for a non-admin (target user never
    even looked up), 401 unauthenticated, 404 without auditing for a missing
    user, and 200 + an `ADMIN_VIEW_USER` audit write for an admin viewing an
    existing user.
  - `api-admin-user-sync.route.test.ts` (7) — 401/403 propagation, 404 for a
    nonexistent target user (rate limit never checked), the rate limit is
    keyed by the *target* user's id (not the admin's), 429 with nothing
    enqueued when exceeded, 409 when the target has no `CONNECTED`
    connection, and the full success path (exact `enqueueManualSyncJob` and
    `enqueueSyncJobToQueue` calls, the audit write, 202 + `{jobId}`).
- **100% statement/branch/function coverage** on every new file
  (`admin.service.ts`, `admin.schemas.ts`, and all three new route files).
- `npx tsc --noEmit`: clean except the same pre-existing `@prisma/client`
  stub-typing gap documented since Phase 1. No new type errors this phase.
- `npx eslint .`: clean.
- **Ran the app live** (`npm run dev` with a temporary `.env.local`, deleted
  afterward): unauthenticated requests to `/admin` and
  `/admin/users/:id` both 307-redirect to `/login?callbackUrl=...` via the
  existing edge middleware, unchanged. `GET /api/admin/users` and
  `POST /api/admin/users/:id/sync` (not covered by the middleware matcher,
  so they self-guard) both compile and 500 with the identical,
  already-documented `@prisma/client did not initialize yet` error — not a
  Phase 8 defect, the same sandbox limitation every Prisma-touching route
  has hit since Phase 1. No regressions observed on any previously-working
  route.

## Known limitations

- **The user-facing "Sync now" button on `/profile/devices` is still
  disabled** (`<Button variant="outline" disabled>`), a pre-existing gap
  from before this phase: Phase 7 built `POST /api/integrations/oura/sync`
  but never wired that page's button to it. Out of scope for Phase 8 (an
  admin phase), noted here so it isn't mistaken for something this phase
  should have fixed.
- **No live Postgres or Redis in this sandbox** — the same category of
  limitation documented in every prior phase. The admin list/detail/sync
  logic is fully unit-tested against mocked Prisma, and the sync route
  reuses Phase 7's queue functions (themselves unit-tested against mocked
  BullMQ/ioredis) unchanged; nothing in this phase has been exercised
  against a real database or a real queue push.
- **§10.6's IDOR/BOLA prose names a route (`GET
  /api/admin/users/{UserB.id}`) that doesn't literally exist** in §8.2's
  endpoint table — this phase interprets it as referring to
  `GET /api/admin/users/:id/dashboard`, the one endpoint that both returns
  per-user data and is individually audited, and documents that
  interpretation directly in the test file's comments.
- **`docker-compose.yml`, a running `npm run worker` process, and a reachable
  `REDIS_URL`** remain deployment/infrastructure setup outside this phase's
  scope, per the same note in the Phase 7 summary.

## Next phase

Phase 9 — Security hardening, per ARCHITECTURE.md §12/§9: the phase table's
remaining items include CSRF/security headers, stricter rate limiting across
auth endpoints, dependency/audit review, and closing out §9's hardening
checklist before Phase 10's MCP/AI-ready layer.
