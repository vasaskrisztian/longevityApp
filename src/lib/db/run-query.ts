import type { Pool } from 'pg';

/**
 * Shared client-checkout helper for every hand-written SQL call in the sync
 * write path (raw-record.service.ts, normalization.service.ts).
 *
 * UPDATE — this used to be a `runQuery(pool, label, sql, values)` helper
 * that did its own connect()+query()+release() cycle PER CALL, so a batch
 * of N records/dates meant N separate checkout/release cycles on the same
 * shared `dbPool`. That turned out to be the real, final root cause of the
 * sync write path's long-standing hang, isolated after storeRawRecords and
 * normalizeAndUpsertDailyMetrics were both already on raw SQL through this
 * exact helper: TWO CONSECUTIVE scheduled sync runs (2026-09-25 03:36 and
 * 2026-09-26 03:37, both on the same deployment, both with unconditional
 * per-call diagnostic logging in place) froze at the identical point —
 * storeRawRecords finishing its ~2200 sequential connect()/query()/
 * release() cycles cleanly, then the very FIRST pool.connect() call from
 * normalizeAndUpsertDailyMetrics (a different function, same pool) never
 * resolving. The diagnostic log printed immediately before that connect()
 * call showed `total=1 idle=1 waiting=0` — the pool's own bookkeeping
 * believed its one client was idle and immediately available — and it
 * still hung forever, never even triggering the 15s hard-timeout backstop
 * (a bare setTimeout, which should be physically incapable of missing
 * unless the event loop itself is wedged). Whatever exactly is going on
 * inside `pg`'s pool internals under that specific pattern (hundreds of
 * rapid sequential checkout/release cycles on one client, immediately
 * followed by a connect() call from a different call site), the fix that
 * actually matches how a Pool is meant to be used is to stop doing that:
 * check out ONE client for an entire batch of queries and reuse it
 * directly, releasing once at the end, instead of cycling connect/release
 * per query. This is also just correct `pg` usage — a Pool exists to let
 * *concurrent* callers share a set of connections, not to serialize
 * hundreds of sequential queries one at a time through repeated checkout.
 *
 * Logging here is strictly bounded: at most one line per withClient() call
 * (i.e. per batch — per sync job per write function, not per record), plus
 * a warning only when a step is slow. See raw-record.service.ts's top
 * comment for the full story of why per-record logging here once caused a
 * very real, separate production outage (Node's stdout is a synchronous,
 * blocking pipe write on Linux; enough log volume to hit Railway's rate
 * limit blocks the write forever, which freezes the entire event loop).
 */

const DB_CONNECT_TIMEOUT_MS = 15_000;
const DB_QUERY_TIMEOUT_MS = 15_000;
const SLOW_STEP_WARN_MS = 1_000;

// A hard, unconditional backstop: `pg`'s own configured timeouts
// (statement_timeout, query_timeout, connectionTimeoutMillis in prisma.ts)
// only start counting once a query is actually dispatched over an
// established connection, or once the pool has decided to open a new one.
// They do nothing for a query stuck queued *inside the pool*, waiting for
// a client to free up. This wraps any pool call in a plain setTimeout race
// so it rejects on its own schedule no matter what layer is stuck.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(`"${label}" did not complete within ${ms}ms — treating this as a hung pg call rather than waiting forever.`),
      );
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

// Deliberately not generic over a per-call row type — callers cast the
// `rows` they get back, same as they would with `pg`'s own `client.query`.
// A generic function type here fought TypeScript's inference more than it
// helped; a plain `any` row shape keeps this file simple and every call
// site already knows (and asserts, via its own types) what shape it expects.
export type BatchQuery = (sql: string, values: unknown[]) => Promise<{ rows: any[] }>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Checks out exactly ONE client for the whole batch `fn` runs, instead of
 * one connect()+release() cycle per query — see this file's top comment
 * for why that distinction turned out to matter. `fn` receives a `query`
 * function that issues queries against that single checked-out client;
 * the client is always released when `fn` settles, success or failure.
 */
export async function withClient<T>(
  pool: Pool,
  label: string,
  fn: (query: BatchQuery) => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  const client = await withTimeout(pool.connect(), DB_CONNECT_TIMEOUT_MS, `${label} connect()`);
  const connectMs = Date.now() - t0;
  if (connectMs > SLOW_STEP_WARN_MS) {
    // eslint-disable-next-line no-console -- deliberately not routed through
    // the app's structured logger: this can fire outside any request/job
    // context, and it's rare enough by design not to need one.
    console.error(
      `[db] ${label}: slow client checkout (${connectMs}ms) — total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`,
    );
  }
  try {
    const query: BatchQuery = (sql, values) => withTimeout(client.query(sql, values), DB_QUERY_TIMEOUT_MS, `${label} query()`);
    return await fn(query);
  } finally {
    client.release();
  }
}
