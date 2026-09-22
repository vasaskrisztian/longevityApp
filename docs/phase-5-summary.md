# Phase 5 — Oura ingestion

ARCHITECTURE.md §12's phased delivery plan puts Phase 5 as: *"Oura
ingestion: API client, raw storage, mappers, normalization."* This phase
builds everything needed to turn a valid access token into rows in
`DailyHealthMetric`/`Workout` — the real Oura v2 API client (and its mock
counterpart), the raw-storage service, the Oura-specific mappers, and the
generic normalization/orchestration layer that ties them together. Nothing
in this phase adds a route, a queue, or a scheduler: per the phase table,
"queue, scheduler, retries, incremental sync" is explicitly **Phase 7**'s
scope. `runSyncForConnection` (this phase's orchestration function) is a
seam with no caller yet, in the same spirit as Phase 3's provider-registry
and Phase 4's `enqueueInitialSyncJob` — Phase 7's worker is what will call
it.

## Implemented

- **`WearableProviderAdapter` extended** (`domain/wearable-provider.types.ts`)
  with three ingestion methods, plus the new domain types they use
  (`ProviderRawRecord`, `FetchRawDataResult`, `NormalizedDailyMetricFields`,
  `NormalizedDailyMetric`, `NormalizedWorkout`):
  - `fetchRawData({accessToken, from, to})` — returns opaque,
    provider-tagged raw records plus a per-data-type `failures` list, so one
    endpoint's failure never discards data another endpoint returned.
  - `mapToNormalizedFields(record)` — maps one raw record to its
    contribution to that day's `DailyHealthMetric` row, or `null`.
  - `mapToWorkout(record)` — maps one raw record to a `Workout` row, or
    `null`.
  Only the adapter itself may ever read `payload`'s shape (mirroring how
  Phase 4 isolated `OAuthTokenSet` from Oura's own JSON) — the generic
  services below never import anything from `providers/oura/*`.
- **`modules/wearable/providers/oura/`**:
  - `oura-data-types.ts` — Oura v2 `usercollection` wire shapes for all six
    data types, consolidated to match what `DailyHealthMetric` needs (see
    Known limitations on real-API fidelity).
  - `oura-api-client.ts` — the real, `fetch`-based client. Every endpoint is
    cursor-paginated (`next_token`); `fetchOuraCollection` walks every page
    before returning. A non-2xx response throws with the endpoint name and
    status.
  - `oura-ingestion-mock.ts` — `OURA_MOCK_MODE=true`'s ingestion side
    (separate from Phase 4's OAuth mock in `oura-mock.ts`): generates
    sleep/readiness/activity/SpO2/a few intraday heart-rate samples for
    every day in the requested window, plus a workout roughly every third
    day. Zero network calls, never fails. Generating "≥30 days" per
    ARCHITECTURE.md §11 falls out naturally from the caller's requested
    window rather than being hard-coded here — a 30-day request produces 30
    days of every daily type, proven in `oura-ingestion-mock.test.ts`.
  - `oura-mappers.ts` — the only place Oura JSON is interpreted:
    `mapOuraRecordToDailyMetric` (seconds→minutes conversions, bedtime
    parsing, `lowest_heart_rate`→`restingHeartRate`) and
    `mapOuraRecordToWorkout` (duration computed from start/end, nulls mapped
    to `undefined`).
  - `oura-provider.ts` extended: `fetchRawData` branches on
    `isOuraMockMode()` exactly like the OAuth methods; in real mode it runs
    all six endpoint calls via `Promise.allSettled` so one endpoint's
    rejection becomes a `failures` entry instead of losing the other five's
    data. `mapToNormalizedFields`/`mapToWorkout` delegate straight to
    `oura-mappers.ts`.
- **`modules/wearable/services/raw-record.service.ts`** — `storeRawRecords`
  is the only function that writes `WearableRawRecord`. Upserts on the
  `(connectionId, dataType, externalId)` compound key (ARCHITECTURE.md
  §7.6); a bulk `findMany` before the upserts is what lets it report
  accurate created/updated counts, since Prisma's `upsert` doesn't say which
  branch fired — a genuine race on the exact same triple would only skew
  that count, never produce a duplicate row (the DB constraint is what
  actually guarantees idempotency).
- **`modules/wearable/services/normalization.service.ts`** —
  `normalizeAndUpsertDailyMetrics` merges every raw record's mapped fields
  by date (a sleep record and an activity record for the same day both
  land in one row) and upserts on `(userId, date)`, growing
  `sourceProviders` without duplicating an already-present provider.
  `normalizeAndUpsertWorkouts` upserts on `(provider, externalId)`.
- **`modules/wearable/services/sync.service.ts`** — `runSyncForConnection`
  orchestrates the whole pipeline: `ensureFreshAccessToken` (Phase 4) →
  `fetchRawData` → `storeRawRecords` + both normalization calls (run
  concurrently — they write to three different tables from the same
  in-memory `records` array, so there's no shared mutable state to race on)
  → `recordSyncOutcome`. Returns a `SyncResult` (`SUCCESS`/`PARTIAL`/
  `FAILED` plus counts and an error code/message) rich enough for Phase 7's
  worker to later persist onto a `SyncJob` row without touching this code.
- **`wearable.service.ts` — `recordSyncOutcome`** — updates
  `WearableConnection.lastSyncAt`/`lastSyncStatus` always, and
  `lastSuccessfulSyncAt` for `SUCCESS` and `PARTIAL` (a partial sync still
  fetched and stored real data for the endpoints that worked, so it resets
  the incremental-sync window per §7.3) but not for `FAILED`.

## Tests

- **51 new tests, 421 total across 52 files, all passing**
  (`npm run test:coverage`) — the full Phase 1–4 suite re-run unchanged
  alongside everything below:
  - `oura-api-client.test.ts` (9) — Bearer header + `start_date`/`end_date`
    query params, single-page and multi-page (`next_token`) responses, the
    non-ok → throw path, and that all six endpoint functions hit the right
    path.
  - `oura-ingestion-mock.test.ts` (7) — failures always empty, one of each
    daily type per day in the window (inclusive of both ends), the ≥30-day
    requirement satisfied for a 30-day window, multiple intraday
    heart-rate samples per day, not every day getting a workout but some
    days do, every record's `externalId`/`dataDate` well-formed, and fresh
    random values on every call.
  - `oura-mappers.test.ts` (8) — every field mapping for all four
    daily-metric-producing data types (seconds→minutes, bedtime parsing,
    `lowest_heart_rate`→resting HR), `null` for HEART_RATE/WORKOUT/OTHER,
    workout duration computed from start/end, null fields mapped to
    `undefined`, and `null` for any non-WORKOUT record.
  - `raw-record.service.test.ts` (6) — no-op on an empty batch, the exact
    upsert shape keyed on the compound constraint, created-vs-updated
    counting (new record, existing record, and a mixed batch), and the
    exact existence-check query shape.
  - `normalization.service.test.ts` (10) — no-op when the adapter maps
    everything to `null`, merging two same-date records into one upsert,
    one upsert per distinct date across a multi-day batch, growing
    `sourceProviders` without dropping or duplicating entries, the
    `(userId, date)` upsert key, workout no-op/upsert/selective-counting
    paths, and the `(provider, externalId)` upsert key.
  - `sync.service.test.ts` (4) — token-refresh failure (FAILED/
    AUTH_REQUIRED, never fetches), every-endpoint-fails (FAILED/
    FETCH_FAILED, never stores), full success (SUCCESS, every downstream
    call gets the right arguments), and partial success (PARTIAL, still
    stores/normalizes whatever did come back).
  - New `describe` blocks added to `oura-provider.test.ts` (mock-vs-real
    `fetchRawData` branching, one-endpoint-fails-doesn't-lose-the-rest, and
    delegation for both mapper methods) and `wearable.service.test.ts`
    (`recordSyncOutcome`'s three status branches), consistent with those
    files' existing conventions.
- **100% statement/branch/function coverage on every Phase 5 module** — no
  exceptions or excluded lines.
- `npx tsc --noEmit`: clean except the same pre-existing `@prisma/client`
  stub-typing gap documented since Phase 1.
- `npx eslint .`: clean — no new `no-restricted-imports` gaps this phase;
  the Phase 4 overrides already cover everything the new ingestion services
  and tests needed (the generic services never import `providers/oura/*`
  directly, only through the `WearableProviderAdapter` parameter).
- **Smoke-tested the mock→mapper pipeline directly** (via `tsx`, no server
  needed): a 30-day `mockFetchRawData` window produced 220 raw records
  (30 sleep/readiness/activity/SpO2 each, 90 heart-rate samples, 10
  workouts), which `oura-mappers.ts` correctly reduced to 120 daily-metric
  contributions and 10 workouts with sane values — proving the whole
  ingestion pipeline's logic end-to-end outside of Prisma.
- **Ran the app live** (`npm run dev`): confirmed nothing in this phase
  regressed the existing `GET /api/wearables` (still 500s with the
  identical, already-documented `@prisma/client did not initialize yet`
  error — `prisma generate` remains blocked in this sandbox,
  `binaries.prisma.sh` still 403s) or `/profile/devices` (still 307s
  unauthenticated visitors to `/login`, unchanged from every prior phase).
  Phase 5 added no new route, so there was no new live endpoint to check
  beyond confirming the build still compiles and boots cleanly with the new
  modules in the dependency graph.

## Known limitations

- Same Prisma-engine sandbox limitation as Phase 1–4; nothing new
  introduced by Phase 5.
- **Oura field-name fidelity**: `oura-data-types.ts`'s shapes are modeled on
  Oura's public v2 API docs but consolidated to fit this app's
  `DailyHealthMetric` schema (e.g. `daily_sleep` here also carries
  duration/HRV/resting-HR detail Oura's real API splits into a separate
  `sleep` endpoint). Nothing in this sandbox can verify field names against
  a live Oura account or a real API response. Because the mock generator
  and the mapper are written against the exact same shape, they're
  internally consistent regardless — but the real (`OURA_MOCK_MODE=false`)
  path should be re-verified against Oura's live API documentation and a
  real sandbox/production API key before the first real sync.
- **`runSyncForConnection` has no caller yet** — by design. Phase 7 builds
  the queue/worker that pulls a `SyncJob` row, computes the incremental
  `syncFrom`/`syncTo` window (§7.3's 2-day overlap), calls this function,
  and writes the result back onto that `SyncJob` row (status transitions,
  `recordsFetched`/`Created`/`Updated`, retry/backoff on 429/5xx). This
  phase intentionally does not touch `SyncJob` rows at all.
- `storeRawRecords`/`normalizeAndUpsertDailyMetrics`/
  `normalizeAndUpsertWorkouts` upsert sequentially (one row at a time, not
  batched) — fine at this phase's volume (dozens to low hundreds of rows
  per sync), called out here in case Phase 7's incremental-sync volume ever
  warrants batching.
- The intraday `HEART_RATE` data type is fetched and stored raw (for
  potential future use, e.g. an intraday chart in a later dashboard phase)
  but doesn't map to any `DailyHealthMetric` field today — the schema has
  no field finer-grained than `restingHeartRate`, which the sleep record
  already supplies.

## Next phase

Phase 6 — Dashboard: the today view and 7/30-day trends, reading from
`DailyHealthMetric`/`Workout` for the first time (everything before this
phase only ever wrote to them). Will need at least one `DailyHealthMetric`
row to render against, which in this sandbox means either seeding via a
script that calls this phase's `normalizeAndUpsertDailyMetrics` directly
with mock data (bypassing the Prisma-generate wall isn't possible, but the
*logic* can still be exercised) or waiting for a real deployment.
