import type { Pool } from 'pg';

/**
 * Shared connect()+query()+release() helper for every hand-written SQL call
 * in the sync write path (raw-record.service.ts, normalization.service.ts).
 * Extracted here once it became clear the same pattern — and the same
 * "never log per iteration of a loop" rule — applies to more than one
 * caller. See raw-record.service.ts's top comment for the full story of
 * why per-record console.error logging here caused a very real production
 * outage (Node's stdout is a synchronous, blocking pipe write on Linux;
 * enough log volume to hit Railway's rate limit blocks the write forever,
 * which freezes the entire event loop — including every setTimeout
 * backstop, which is why none of them had ever fired despite very long
 * real hangs).
 *
 * Logging here is strictly bounded: a warning only when a step is slow
 * enough to be worth knowing about, never one per call — regardless of how
 * many times this is called in a loop.
 */

const DB_QUERY_TIMEOUT_MS = 15_000;
const SLOW_STEP_WARN_MS = 1_000;

// A hard, unconditional backstop: `pg`'s own configured timeouts
// (statement_timeout, query_timeout, connectionTimeoutMillis in prisma.ts)
// only start counting once a query is actually dispatched over an
// established connection, or once the pool has decided to open a new one.
// They do nothing for a query stuck queued *inside the pool*, waiting for
// a client to free up. This wraps any pool call in a plain setTimeout race
// so it rejects on its own schedule no matter what layer is stuck.
function withQueryTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `runQuery: "${label}" did not complete within ${DB_QUERY_TIMEOUT_MS}ms — ` +
            `treating this as a hung pg call rather than waiting forever.`,
        ),
      );
    }, DB_QUERY_TIMEOUT_MS);
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

export async function runQuery<T>(
  pool: Pool,
  label: string,
  sql: string,
  values: unknown[],
): Promise<{ rows: T[] }> {
  const t0 = Date.now();
  const client = await withQueryTimeout(pool.connect(), `${label} connect()`);
  const connectMs = Date.now() - t0;
  if (connectMs > SLOW_STEP_WARN_MS) {
    // eslint-disable-next-line no-console -- deliberately not routed through
    // the app's structured logger: this can fire outside any request/job
    // context, and it's rare enough by design not to need one.
    console.error(
      `[db] ${label}: slow pool checkout (${connectMs}ms) — total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`,
    );
  }
  try {
    const t1 = Date.now();
    const result = await withQueryTimeout(client.query(sql, values), `${label} query()`);
    const queryMs = Date.now() - t1;
    if (queryMs > SLOW_STEP_WARN_MS) {
      // eslint-disable-next-line no-console -- see comment above
      console.error(`[db] ${label}: slow query (${queryMs}ms)`);
    }
    return result as { rows: T[] };
  } finally {
    client.release();
  }
}
