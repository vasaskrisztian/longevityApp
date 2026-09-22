# Phase 6 — Dashboard

ARCHITECTURE.md §12's phased delivery plan puts Phase 6 as: *"Dashboard:
today view, 7/30-day trends."* This is the first phase that ever **reads**
`DailyHealthMetric`/`Workout` — every phase before it (Phase 5's
normalization service) only wrote to them. It builds a small,
provider-agnostic read layer, two authenticated API routes, and rewrites the
dashboard and trends pages to render real data with an honest empty state
when none exists yet.

## Implemented

- **`modules/dashboard/dashboard.service.ts`** (new) — strictly read-only,
  and, like the rest of `modules/wearable/domain`, has no idea Oura exists;
  it only reads whatever Phase 5's normalization already wrote.
  - `getTodaySnapshot(userId)` — the dashboard's "today" card. Returns the
    most recent `DailyHealthMetric` row at or before today, with an
    `isToday` flag distinguishing a genuine today-row from a stale fallback
    (daily sync doesn't exist until Phase 7, and even once it does, a given
    day's sync may not have landed yet — so this deliberately shows the most
    recent available day rather than a hard "no data for today" wall).
    Returns `null` only when the user has no rows at all.
  - `getTrend(userId, rangeDays)` — a complete, gap-filled array of
    `TrendPoint`s for a 7- or 30-day window (`rangeDays` is `7 | 30` per
    ARCHITECTURE.md §13), oldest first, with all-null fields on days that
    have no underlying row — so chart code downstream never has to handle
    sparse data itself.
  - Both convert the `averageHrv` Prisma `Decimal` column to a plain number
    via `Number()` — the generated client returns a Decimal.js instance, not
    a number, and this is the first code in the project to ever read that
    column back (Phase 5 only ever wrote it).
- **`lib/validation/dashboard.schemas.ts`** (new) — `TrendRangeQuerySchema`
  validates the `?range=` query string as `'7' | '30'` (default `'7'`); the
  route converts the validated string to the `7 | 30` number the service
  wants.
- **`GET /api/dashboard`** (new) — `requireAuthenticatedUser()` →
  `getTodaySnapshot(userId)`, scoped strictly to the caller's own id, same
  IDOR choke-point convention as every other user-scoped route.
- **`GET /api/dashboard/trends?range=7|30`** (new) — same auth pattern, plus
  Zod validation of `range`; an out-of-enum value (e.g. `?range=14`) is
  rejected with 400 before the service is ever called.
- **`app/dashboard/page.tsx`** (rewritten) — now uses `getProfileBundle`
  (replacing a direct `prisma.profile.findUnique` call),
  `getConnectionForUserAndProvider`, and `getTodaySnapshot` instead of
  placeholder `ScoreCard`s. Renders Sleep/Readiness/Activity scores, HRV,
  resting heart rate, sleep duration (formatted as `Xh Ym`) and steps, a
  banner when the shown day is a stale fallback rather than today, and an
  empty-state card (with different copy depending on whether Oura is
  connected yet) when the user has no data at all.
- **`app/trends/page.tsx`** (rewritten, server component) — fetches the
  initial 7-day trend server-side via `getTrend` and passes it to a new
  client component.
- **`app/trends/trend-charts.tsx`** (new client component) — built with
  `recharts`, following the dataviz skill's method end to end:
  - A combined "Scores" line chart (Sleep/Readiness/Activity, 0-100) using
    the skill's validated categorical order — blue `#2a78d6`, orange
    `#eb6834`, aqua `#1baf7a` — with a legend, since ≥2 series must never
    rely on color alone.
  - Four single-series charts (HRV, resting heart rate, sleep duration,
    steps) in the app's own `primary` teal (`#0F4C42`), with no legend — a
    single series needs none, the card title already names it.
  - A 7-day/30-day toggle (`Button`/`buttonVariants`, `aria-pressed`) that
    client-fetches `/api/dashboard/trends?range=` and swaps the dataset.
  - Hover tooltips on every chart (recharts' `<Tooltip/>`), 2px lines, small
    dots, recessive gridlines/axes.
  - A "Show as table" toggle rendering the same data as an HTML `<table>` —
    the accessibility-pass table-view requirement — and a distinct empty
    state per chart when a range has no data at all.

## Tests

- **25 new tests, 446 total across 57 files, all passing**
  (`npm run test:coverage`):
  - `dashboard.service.test.ts` (15) — `getTodaySnapshot`'s null-when-no-rows
    case, the exact scoped query shape, `isToday` true/false branching, the
    `averageHrv` Decimal→Number conversion (including the null-stays-null
    case, never `Number(null)` producing `0`), every plain field's
    null/undefined fallback, `sourceProviders` defaulting; `getTrend`'s
    exact inclusive date-window query for both 7- and 30-day ranges, the
    complete gap-filled result length and ordering, gap days getting
    all-null fields, and multiple rows landing on their correct distinct
    dates.
  - `api-dashboard.route.test.ts` (4) and `api-dashboard-trends.route.test.ts`
    (6) — 401/403 propagation without ever calling the service, the
    scoped-to-caller's-own-id call shape, the range validation/400 path, and
    the default-to-7-days behavior.
- **100% statement/branch/function coverage on `dashboard.service.ts`** and
  both new routes — no exceptions or excluded lines.
- `npx tsc --noEmit`: clean except the same pre-existing `@prisma/client`
  stub-typing gap documented since Phase 1.
- `npx eslint .`: clean.
- **Ran the app live** (`npm run dev`): `/dashboard` and `/trends` both
  307-redirect unauthenticated visitors to `/login`, unchanged from every
  prior phase. `GET /api/dashboard` and `GET /api/dashboard/trends` both
  compile and 500 with the identical, already-documented
  `@prisma/client did not initialize yet` error (`prisma generate` remains
  blocked in this sandbox, `binaries.prisma.sh` still 403s) — not a Phase 6
  defect, the same sandbox limitation every phase since Phase 1 has hit for
  any Prisma-touching route.

## Known limitations

- Same Prisma-engine sandbox limitation as every prior phase.
- **No dark mode exists anywhere in this app yet** (verified: no
  `next-themes`, no `ThemeProvider`, no `dark:` Tailwind usage anywhere in
  the codebase) — so the dataviz skill's dark-mode accessibility step is
  deliberately out of scope this phase. The chart colors are validated for
  light mode only; a dark-mode chart variant is real future work, not an
  oversight, and should be added together with whichever phase first
  introduces dark mode for the rest of the app.
- **No live Oura data has ever produced a real `DailyHealthMetric` row in
  this sandbox** (Phase 7's sync worker is what will call Phase 5's
  `runSyncForConnection`) — so the dashboard/trends pages have been
  exercised against unit tests and the mock-mode ingestion pipeline's
  verified output shape, but not against a live, rendered browser session
  with real rows in the database. Nothing about this phase's code depends
  on mock vs. real data (it only reads `DailyHealthMetric`/`Workout`,
  which look identical either way), but this is called out explicitly
  rather than presented as fully browser-verified.
- **No per-chart CSV/image export** — the "Show as table" toggle covers the
  accessibility requirement (a non-chart way to read the same values) but
  does not add a download; out of scope for this phase's acceptance
  criteria.
- **Sleep duration has no chart-level unit toggle** (minutes only, though
  the dashboard's "today" card formats it as `Xh Ym`) — consistent, not
  incomplete, but worth a follow-up if users want the trend chart itself in
  hours.

## Next phase

Phase 7 — Background sync: the queue, scheduler, retries and incremental
sync that actually call Phase 5's `runSyncForConnection` on a schedule, so
`DailyHealthMetric` starts filling in for real and this phase's dashboard
and trends pages have live data to show beyond the empty state.
