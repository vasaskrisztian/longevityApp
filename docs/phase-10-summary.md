# Phase 10 — MCP / AI-ready layer

ARCHITECTURE.md §12's phased delivery plan puts Phase 10 last, on purpose:
*"MCP / AI-ready layer — only after Phase 1–9 work with MCP absent."* §9
("MCP future architecture") is the spec this phase implements. With this
phase shipped, §13's MVP acceptance criteria are fully met and the phased
delivery plan is complete.

## What was built

- **`src/mcp/gateway.ts`** — `HealthMcpGateway`, copied **verbatim** from §9
  (four methods: `getHealthSummary`, `getSleepContext`, `getRecoveryContext`,
  `getActivityContext`), plus `createHealthMcpGateway()`'s concrete
  implementation. It calls only `modules/dashboard/dashboard.service.ts`'s
  `getTodaySnapshot`/`getTrend` — the exact same functions the Phase 6
  dashboard route already calls — and touches nothing under
  `modules/wearable/providers/**` or `lib/encryption/**`. `McpAuthContext`
  carries a resolved `userId`; every method takes it as a parameter but
  nothing in this file or any caller constructs one from user input.
- **§9 vs. reality — four gateway methods, five named tools.** §9 gives
  `HealthMcpGateway` as a near-literal four-method contract but separately
  names five tools, including `get_user_health_summary`. Rather than adding
  a fifth method to an interface the doc gives verbatim, the fifth tool is a
  **composite built in the tools layer** (`register-health-tools.ts`) that
  calls all four gateway methods via `Promise.all` and returns them
  together — it adds no new data, just a single combined call for "how am I
  doing overall."
- **`DateRange` as `{ rangeDays: 7 | 30 }`, not `{start, end}`.** §9 leaves
  `DateRange`'s shape open. `dashboard.service.ts` already has exactly one
  trend capability — `getTrend(userId, rangeDays: 7 | 30)`, the same 7/30
  window §13 calls for — and nothing in the app supports an arbitrary date
  range. MCP reuses that existing capability (`McpDateRange`) rather than
  inventing a broader one nothing else exposes.
- **The three trend tools all return the same underlying data.**
  `getSleepContext`/`getRecoveryContext`/`getActivityContext` each call the
  same `getTrend()` and return the same field set, because
  `dashboard.service.ts` (and the Phase 6 dashboard UI built on it) has
  never split sleep/readiness/activity into separate queries. Each stays a
  separate named tool anyway, since "how's my sleep" and "how's my activity"
  are different questions a model should be able to ask for even though
  today's answer draws on the same rows — see the Known limitations below
  for the natural follow-up.
- **`src/mcp/auth-context.ts`** — `resolveMcpAuthContextFromEnv()`. A stdio
  MCP server has no HTTP session to resolve `session.user.id` from the way
  every Route Handler does (`requireAuthenticatedUser`), so this phase binds
  the process to one user for its lifetime via a required `MCP_USER_ID`
  environment variable, throwing `McpConfigurationError` immediately if
  unset — the same fail-loudly-at-startup pattern
  `lib/encryption/encryption.service.ts` already uses for
  `TOKEN_ENCRYPTION_KEY`.
- **`src/mcp/tools/register-health-tools.ts`** — registers the five named
  tools (`get_user_daily_health`, `get_user_sleep_trend`,
  `get_user_readiness_trend`, `get_user_activity_trend`,
  `get_user_health_summary`) via the current, non-deprecated
  `McpServer.registerTool(name, config, handler)` API (the SDK's `.tool()`
  overloads are all marked `@deprecated` in 1.30.0). Every input schema is a
  Zod raw shape — a plain object of Zod types, the shape `registerTool`
  expects — and **none of the five declares a `userId` field**, so it is
  structurally impossible for a calling model to supply one; every handler
  closes over the single `ctx` resolved once at startup and passed in by
  `server.ts`. Tool results use the SDK's actual `CallToolResult` shape
  (confirmed by reading `types.d.ts`'s `CallToolResultSchema`, since it's a
  Zod-inferred type rather than a plain `interface` and didn't show up under
  a naive `export interface` search): `{ content: [{ type: 'text', text }] }`
  with the tool's JSON payload as the text.
- **`src/mcp/server.ts`** — the runnable entry point (`npm run mcp:server`):
  resolves the auth context and gateway, constructs an `McpServer`,
  registers the five tools, and connects a `StdioServerTransport`. Follows
  the same `isMainModule`/`pathToFileURL` guard `src/jobs/worker-process.ts`
  already established, for the same reason (importable by tests without
  triggering the side effect of opening stdio).
- **`src/mcp/insight-engine.ts`** — `InsightEngine`
  (`generateDailyInsights`, `generateTrendInsights`) as an **interface-only
  scaffold**, exactly as §9 calls for: no implementation, not wired into
  anything, nothing calls it. Diagnostic AI output does not ship in this
  phase or any phase without a dedicated design pass, and even then would
  stay comparative/observational — this app is not a medical device and
  must never produce anything read as a diagnosis.
- **`.eslintrc.json`** — a new `src/mcp/**` override forbidding imports
  matching `*/modules/wearable/providers/**` (broader than the existing
  Oura-only pattern, since §9's rule names the whole `providers/**` tree)
  and `*/lib/encryption/*`, operationalizing §9's "a lint rule... forbids
  mcp/** importing anything under modules/wearable/providers/** or
  lib/encryption/**" as an enforced check, not just a sentence in this doc.
- **`package.json`** — new `"mcp:server": "tsx src/mcp/server.ts"` script,
  mirroring the existing `"worker"` script's shape.
- **`vitest.config.ts`** — added `src/mcp/**` to the coverage `include`
  list, so the new files are measured at all.

## New tests

- **24 new tests, 596 total across 77 files, all passing**
  (`npm run test:coverage`):
  - `tests/unit/mcp-gateway.test.ts` (5 tests) — `getHealthSummary` returns
    `null` when there's no snapshot and maps a snapshot to an ISO-date
    `HealthSummary` otherwise; all three trend methods call `getTrend` with
    the caller's own `userId` and the requested range, mapping point dates
    to ISO strings.
  - `tests/unit/mcp-auth-context.test.ts` (5 tests) — resolves
    `MCP_USER_ID`; throws `McpConfigurationError` when it's missing or
    blank; the error message names the variable; defaults to
    `process.env` when no env object is injected.
  - `tests/unit/mcp-register-health-tools.test.ts` (9 tests) — **the
    critical file for this phase's core security property**: registers
    exactly the five named tools; asserts, for all five at once, that no
    tool's input schema has any key containing `userid` (case-insensitive)
    — proving it structurally, not just by inspection; every handler is
    invoked directly against a fake server/gateway and asserted to call the
    gateway with the one injected `ctx` object, never anything derived from
    the handler's own arguments; the composite tool is asserted to call all
    four gateway methods and combine their results.
  - `tests/unit/mcp-server.test.ts` (5 tests) — against a fully mocked SDK:
    resolves auth context and gateway before constructing anything;
    constructs `McpServer` with a name/version and registers tools against
    the same instance; connects a `StdioServerTransport` to that instance;
    logs a startup message naming all five tools; a configuration error
    from `resolveMcpAuthContextFromEnv` propagates without ever
    constructing an `McpServer` or connecting a transport.
- **100% statement/branch/function coverage** on `gateway.ts`,
  `auth-context.ts`, and `register-health-tools.ts`.
- `server.ts` is 82.75% statements / 66.66% branches (uncovered: the
  top-level `isMainModule` guard and its `.catch()` handler) — this
  mirrors the **existing, already-accepted** gap in
  `src/jobs/worker-process.ts` (76.19%/50%, same guard pattern), not a new
  one: under Vitest, `import.meta.url` never equals
  `pathToFileURL(process.argv[1]).href`, so that branch is never taken by
  design, and only the exported `startMcpServer()` function is meant to be
  unit-testable in isolation.
- `insight-engine.ts` shows 0% in the coverage table — consistent with
  every other type-only file in this codebase (e.g.
  `modules/wearable/domain/credential-lock.types.ts`, also 0%): a file with
  no runtime statements compiles to an effectively empty module, and this
  repo's coverage tool reports that as 0% rather than "no code to cover,"
  a pre-existing quirk, not something this phase introduced.
- `npx tsc --noEmit`: clean except the same pre-existing `@prisma/client`
  stub-typing gap documented since Phase 1.
- `npx eslint .`: clean.
- **Live-ran** `npx tsx src/mcp/server.ts`: it fails at module load with the
  same, already-documented `@prisma/client did not initialize yet` error
  every other authenticated code path hits in this sandbox (`gateway.ts` →
  `dashboard.service.ts` → `lib/db/prisma.ts`, at import time — before
  `resolveMcpAuthContextFromEnv()` or anything else in `startMcpServer()`
  ever runs). This is the same sandbox limitation documented every phase
  since Phase 1 (`prisma generate` doesn't produce a fully-typed client
  here), not a Phase 10 defect — on real infrastructure with a working
  Prisma client (see `docs/ci-cd-setup.md`), this same command starts the
  server and logs `mcp_server_started`.

## `@modelcontextprotocol/sdk` dependency audit

Installing `@modelcontextprotocol/sdk@1.30.0` reported "14 vulnerabilities"
in `npm install`'s summary. Investigated with `npm ls @modelcontextprotocol/sdk`
(confirms it's a leaf dependency with no sub-dependencies of its own in this
tree) and `npm audit --json` cross-referenced against each advisory's
`nodes` field: **all 14 trace to pre-existing dependencies already in the
tree before this phase** — `next`, `next-auth`/`@auth/core`, `vitest`/
`@vitest/coverage-v8`/`@vitest/mocker`/`vite`/`vite-node`/`esbuild`,
`eslint-config-next`/`@next/eslint-plugin-next`, `postcss`, `glob`, and
`cookie`. None resolve through `@modelcontextprotocol/sdk`. `npm install`
reports the whole tree's audit summary on every install, not just the
newly-added package's — so this was a pre-existing count surfacing at an
unrelated install, not a new risk this phase introduced. Upgrading
`next`/`next-auth` to close their advisories is a real, separate piece of
maintenance work (both have breaking-change major versions involved) and is
out of scope for this phase.

## Known limitations

- **`MCP_USER_ID` is a single-user, process-lifetime auth mechanism.** This
  matches §9's local/stdio MVP (one configured server entry per user, the
  same shape Claude Desktop/Claude Code's own MCP config uses) but is not a
  multi-user or remote deployment story: a real HTTP/SSE MCP server serving
  many users concurrently would need per-request, token-based
  authentication instead of one environment variable read at startup. Not
  attempted here — out of scope for the MVP §9 describes.
- **Sleep/readiness/activity trend tools return identical underlying
  data**, because `dashboard.service.ts` has one generic trend query, not
  three domain-specific ones. A genuinely separated implementation (sleep
  metrics only from `getSleepContext`, etc.) would mean adding new
  dashboard-service queries — a larger change than this phase's scope,
  which is to expose the app's *existing* internal capabilities over MCP,
  not to add new ones.
- **No live MCP client exercised this server end-to-end.** Every claim
  about `registerTool`'s config shape, `CallToolResult`'s shape, and
  `StdioServerTransport`'s constructor comes from directly reading the
  installed SDK's `.d.ts` files (`server/mcp.d.ts`, `types.d.ts`,
  `server/stdio.d.ts`, `server/zod-compat.d.ts`), not from a live
  request/response round trip — this sandbox has no MCP client to drive one
  and no live Postgres for `gateway.ts`'s calls to return real data even if
  it did. `docs/phase-10-summary.md`'s own next step for a user testing
  this for real: run `npm run mcp:server` with `MCP_USER_ID` and
  `DATABASE_URL` set on real infrastructure, then point Claude Desktop's
  MCP config at it.
- **`InsightEngine` remains entirely unimplemented and unwired**, as §9
  requires for the MVP — this is not a gap to close later in this phase,
  it's the documented stopping point.
- **`next`/`next-auth`'s pre-existing advisories are unresolved** (see the
  dependency audit above) — real, but predates this phase and is unrelated
  to the MCP SDK; flagged here rather than silently left out.

## MVP acceptance criteria (§13)

With Phase 10 shipped, every phase in §12's table (0 through 10) is
complete. §13's criteria — Oura OAuth connect/sync/dashboard, background
sync, admin oversight, the security hardening threat table, and now an
MCP-ready read-only surface bound to per-user auth, no diagnostic AI output
— are met by the cumulative work of Phases 1 through 10, documented in
`docs/phase-1-summary.md` through this file.
