# Phase 7 — Background sync

ARCHITECTURE.md §12's phased delivery plan puts Phase 7 as: *"Background
sync: queue, scheduler, retries, incremental sync."* Phase 5 built
`runSyncForConnection` as a seam with no caller; Phase 4 left
`enqueueInitialSyncJob` writing a `SyncJob` row nothing ever processed. This
phase closes both loops: a real BullMQ queue/worker pair, the daily
scheduler, the incremental-window and retry-classification logic (§7.3/
§7.4), and the manual "sync now" endpoint (§7.5) — plus wiring the OAuth
callback's INITIAL job onto the new queue so it actually runs.

## Implemented

- **`modules/wearable/services/sync-window.service.ts`** (new, pure) —
  `computeSyncWindow({type, lastSuccessfulSyncAt, now})`: INITIAL (or any
  type on a connection that's never synced successfully) → the last 30 days
  (§7.1/§11); DAILY/MANUAL with a prior success → `lastSuccessfulSyncAt - 2
  days` through now (§7.3's safety overlap for Oura's own score revisions).
- **`modules/wearable/services/sync-retry-policy.ts`** (new, pure) —
  `computeBackoffDelayMs(attemptsMade)` implements §7.4's exact schedule
  (1min/5min/30min, clamped beyond that), `MAX_SYNC_JOB_ATTEMPTS = 4`, and
  `isRetryableSyncFailure({status, errorCode})`: only a fully-`FAILED` sync
  with a transient `FETCH_FAILED` is retried — `AUTH_REQUIRED` would hit the
  identical rejection every time until the user reconnects, and `PARTIAL`
  already stored what it could and gets naturally re-covered by the next
  daily sync's 2-day overlap.
- **`modules/wearable/services/sync-job.service.ts`** (extended) —
  `enqueueManualSyncJob`, `enqueueDailySyncJobsForActiveConnections` (§7.2:
  one `DAILY` row per `CONNECTED` connection), `markSyncJobRunning`,
  `completeSyncJob` (writes a `SyncResult` back onto the row: status,
  `recordsFetched/Created/Updated`, `retryCount`, `errorCode/Message`,
  `finishedAt`) — all DB-only, mocking Prisma exactly like every other
  function in this file.
- **`modules/wearable/services/sync-job-runner.service.ts`** (new) —
  `runQueuedSyncJob({jobId, adapter, attemptsMade})`: the function every
  queue worker calls. Loads the job + its connection, computes the window,
  marks `RUNNING`, calls Phase 5's `runSyncForConnection`, writes the result
  back, and throws `RetryableSyncJobError` for a retryable failure so the
  BullMQ layer can retry it — everything else (`SUCCESS`/`PARTIAL`/
  `FAILED`+`AUTH_REQUIRED`) resolves normally.
- **`lib/queue/connection.ts`** / **`lib/queue/queues.ts`** (new) — a lazy
  (`lazyConnect: true`) singleton ioredis connection (`maxRetriesPerRequest:
  null`, BullMQ's own requirement) and one `Queue` per `SyncJobType`
  (`oura-initial-sync`/`oura-daily-sync`/`oura-manual-sync`) plus the
  scheduler's own `oura-daily-sync-scan` queue. `enqueueSyncJobToQueue(type,
  jobId)` is the only function that pushes a real job — deliberately split
  from `sync-job.service.ts`'s DB-only functions so nothing there needs
  Redis to be unit-tested.
- **`jobs/wearable-sync.job.ts`** (new) — `createSyncQueueProcessor(adapter)`
  is the provider-agnostic processor (accepts a minimal `{data:{jobId},
  attemptsMade}` shape, not a real BullMQ `Job`, so it's unit-tested without
  mocking `bullmq` at all); `startSyncWorker(queueName, adapter)` is the
  thin BullMQ `Worker` wiring shared by the three files below, registering
  `computeBackoffDelayMs` as the worker's custom backoff strategy.
- **`jobs/oura-initial-sync.job.ts`, `oura-daily-sync.job.ts`,
  `oura-manual-sync.job.ts`** (new) — per ARCHITECTURE.md §2's repository
  layout, one worker-entry-point file per `SyncJobType`, each just calling
  `startSyncWorker` with its queue name and the Oura adapter (the only
  files in `jobs/` that know Oura exists).
- **`jobs/scheduler.ts`** (new) — `runDailySyncScan()` (§7.2's scan:
  `enqueueDailySyncJobsForActiveConnections` + push each onto the DAILY
  queue), `scheduleDailySyncScan()` (idempotently upserts a 03:00 UTC daily
  repeatable trigger via BullMQ's `upsertJobScheduler`), and
  `startDailySyncScanWorker()` (the worker that runs the scan when the
  trigger fires).
- **`jobs/worker-process.ts`** (new) — the standalone worker process
  ARCHITECTURE.md §1.4 calls for ("one deployable Next.js app + one worker
  process"), run via the new `npm run worker` script. Starts all four
  workers and registers the scheduler; never imported by the Next.js app
  itself, so `next build`/`next dev` never open a Redis connection just by
  loading a route module that imports `lib/queue/*`.
- **`POST /api/integrations/oura/sync`** (new, §7.5) — authenticates,
  rate-limits to 1 per user per 5 minutes (`checkRateLimit` keyed by
  `userId`, using the `MANUAL_SYNC_RATE_LIMIT` constant that had sat unused
  in `rate-limit.ts` since Phase 1), requires a `CONNECTED` Oura connection
  (409 otherwise), enqueues a `MANUAL` `SyncJob`, pushes it onto the queue,
  and returns 202 with `{jobId}` — never blocking on the sync itself.
- **`app/api/integrations/oura/callback/route.ts`** (modified) — now pushes
  the `INITIAL` job it creates onto the real queue
  (`enqueueSyncJobToQueue('INITIAL', jobId)`), closing the loop Phase 4 left
  open ("nothing consumes/processes this row yet").
- **`.eslintrc.json`** — added an override for `src/jobs/oura-*.job.ts`
  mirroring the existing `app/api/integrations/oura/**` one (lifts the
  provider-import restriction for these three Oura-named worker entry
  points; `wearable-sync.job.ts`, `scheduler.ts`, and `worker-process.ts`
  stay fully provider-agnostic and need no override).

## Tests

- **103 new tests, 521 total across 65 files, all passing**
  (`npm run test:coverage`):
  - `sync-window.service.test.ts` (6) — every INITIAL/DAILY/MANUAL ×
    has-synced-before/never-synced combination, and that job type is
    checked before `lastSuccessfulSyncAt` (an INITIAL job never uses the
    2-day-overlap branch even if the field happens to be set).
  - `sync-retry-policy.test.ts` (10) — the exact 1/5/30-minute schedule,
    clamping beyond attempt 3, and all four `isRetryableSyncFailure`
    branches (FAILED+FETCH_FAILED retries; FAILED+AUTH_REQUIRED, PARTIAL,
    and SUCCESS all don't).
  - New `describe` blocks in `sync-job.service.test.ts` (10 total) —
    `enqueueManualSyncJob`'s exact create payload,
    `enqueueDailySyncJobsForActiveConnections`'s CONNECTED-only query and
    one-row-per-connection creation (including the zero-connections case),
    `markSyncJobRunning`'s update shape, and `completeSyncJob`'s
    SUCCESS/FAILED/retryCount-default/retryCount-passthrough branches.
  - `sync-job-runner.service.test.ts` (13) — job-not-found short-circuits
    everything else; the scoped `findUnique` shape; the window is computed
    from the job's own type and its connection's `lastSuccessfulSyncAt`
    (including a missing connection treated as never-synced);
    `markSyncJobRunning` happens strictly before `runSyncForConnection`;
    the exact `runSyncForConnection` call shape; `completeSyncJob` receives
    `attemptsMade` as `retryCount` (defaulting to 0); SUCCESS/PARTIAL/
    FAILED+AUTH_REQUIRED all resolve normally; FAILED+FETCH_FAILED writes
    the result THEN throws `RetryableSyncJobError`; and the error message's
    errorCode fallback when errorMessage is absent.
  - `queue-connection.test.ts` (5) — the exact ioredis construction options
    (`maxRetriesPerRequest: null`, `lazyConnect: true`), the `REDIS_URL`
    env var vs. the localhost fallback, singleton behavior, and the test
    reset hook.
  - `queue-queues.test.ts` (9) — the three queue names, `getQueue`'s
    per-name singleton behavior, `enqueueSyncJobToQueue` routing each
    `SyncJobType` to its own queue, and the §7.4 attempts/backoff job
    options.
  - `wearable-sync.job.test.ts` (5) — the processor delegates to
    `runQueuedSyncJob` with the right arguments, propagates a rejection
    (so BullMQ sees the failure), returns the resolved result, and
    `startSyncWorker` constructs a `Worker` with the shared connection and
    registers `computeBackoffDelayMs` as its backoff strategy.
  - `oura-sync-workers.job.test.ts` (3) — each of the three Oura worker
    entry points starts a worker on its own queue with the Oura adapter.
  - `scheduler.test.ts` (5) — `runDailySyncScan`'s zero-connections and
    multi-connection push behavior, `scheduleDailySyncScan`'s exact
    `upsertJobScheduler` call (id, cron pattern, job name), and that the
    scan worker's processor actually runs the scan.
  - `worker-process.test.ts` (3) — `startWorkerProcess` starts all four
    workers, registers the scheduler, and logs a startup message naming
    every queue.
  - `api-oura-sync.route.test.ts` (7) — 401/403 propagation, the rate limit
    is keyed by `userId` (not IP), 429 when exceeded, 409 for no connection
    and for `AUTH_REQUIRED`, and the full success path (right
    `enqueueManualSyncJob` call, right queue push, 202 + `{jobId}`).
  - Extended `api-oura-callback.route.test.ts` — the success test now also
    asserts `enqueueSyncJobToQueue('INITIAL', jobId)` is called, and the
    exchange-failure test asserts it's never called.
- **100% statement/branch/function coverage** on every new service, queue,
  and route file. `jobs/worker-process.ts` is 92%/50% branch — see Known
  limitations below for the one deliberately-uncovered line.
- `vitest.config.ts`: added `src/jobs/**` to the coverage `include` list (it
  didn't exist before this phase).
- `npx tsc --noEmit`: clean except the same pre-existing `@prisma/client`
  stub-typing gap documented since Phase 1. Two new, real type errors were
  caught and fixed during this phase (not pre-existing-gap noise): a
  `logger.info` call passing an array where `LogFields` requires a scalar
  (fixed by joining it to a string), and indexing `SYNC_QUEUE_NAMES` by a
  bare `SyncJobType` (fixed with a `keyof typeof` cast).
- `npx eslint .`: clean.
- **Ran the app live** (`npm run dev`): `/dashboard`, `/trends`, and
  `/profile/devices` still 307-redirect unauthenticated visitors,
  unchanged. `GET /api/integrations/oura/connect` and the new
  `POST /api/integrations/oura/sync` both compile and 500 with the
  identical, already-documented `@prisma/client did not initialize yet`
  error — not a Phase 7 defect. One new observation: the dev server logs a
  webpack "Module not found: @valkey/valkey-glide" warning when a route
  importing `lib/queue/queues.ts` is first compiled — BullMQ's own optional
  support for an alternative Redis-compatible client that isn't installed
  (and isn't needed; this app uses `ioredis`). It's a build-time warning
  only, does not affect the request, and is called out here rather than
  silently ignored.

## Known limitations

- **No live Redis in this sandbox** — the same category of limitation as
  `prisma generate` being blocked. `lazyConnect: true` means nothing
  attempts a connection just from importing `lib/queue/*` or `next build`/
  `next dev` loading a route module, so the app still boots and serves
  every route exactly as before; but no queue push, worker, or the
  scheduler's repeatable trigger has ever been exercised against a real
  Redis in this environment. Every piece of actual logic (window
  computation, retry classification, job bookkeeping, processor wiring) is
  instead fully unit-tested against mocks — the same standard this project
  has applied to every Prisma-touching service since Phase 1.
- **`jobs/worker-process.ts`'s top-level `if (isMainModule) { ... }` guard
  is not unit-tested** (lines 39-43, the file's only coverage gap) — it's
  the bootstrap branch that only runs when this file is executed directly
  as `npm run worker`, not imported; the exported `startWorkerProcess()`
  function it calls IS fully tested. This is a deliberate, narrow exception
  in the same spirit as the pre-existing `oura-types.ts`/`oura-data-types.ts`
  pure-type-file gaps, not a coverage shortfall on real logic.
- **`docker-compose.yml` (mentioned in ARCHITECTURE.md §2) does not exist
  yet** in this repo — Phase 1 never added one (no live Postgres either),
  and this phase doesn't add one for Redis. A real deployment needs a
  reachable `REDIS_URL` and a running `npm run worker` process alongside
  the Next.js app; this is infrastructure/deployment setup outside any
  single phase's application-code scope.
- **BullMQ's `removeOnComplete`/`removeOnFail` retention (7/30 days,
  `queues.ts`'s `syncJobOptions`)** is a reasonable default, not a value
  from ARCHITECTURE.md (which doesn't specify one) — worth revisiting once
  real job volume is known.
- **The admin-triggered sync endpoint (`POST /api/admin/users/:id/sync`,
  ARCHITECTURE.md §8.2) is explicitly Phase 8's scope**, not this phase's —
  Phase 7 only builds the queue/worker/scheduler machinery and the
  user-facing manual-sync endpoint; Phase 8 will call the same
  `enqueueManualSyncJob` + `enqueueSyncJobToQueue('MANUAL', ...)` pair this
  phase built, from an admin-scoped route with its own audit logging.

## Next phase

Phase 8 — Admin: users list, search/filters, user detail, and the
admin-triggered manual sync that reuses this phase's `enqueueManualSyncJob`/
`enqueueSyncJobToQueue` — now with `DailyHealthMetric` rows actually
flowing in real deployments (mock or live Oura) once a worker process and
Redis are running alongside the app.
