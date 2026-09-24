import { randomUUID } from 'node:crypto';
import { dbPool } from '@/lib/db/prisma';
import type { ProviderRawRecord, WearableProviderId } from '../domain/wearable-provider.types';

/**
 * ARCHITECTURE.md §7.6: `WearableRawRecord` is unique on
 * `(connectionId, dataType, externalId)` — any retry, at any layer, upserts
 * rather than duplicates. This is the ONLY function that writes
 * WearableRawRecord; nothing here interprets `payload` (it's opaque JSON
 * all the way through) — that's oura-mappers.ts's job, one layer up.
 *
 * This talks to Postgres directly through `dbPool`'s own, independent `pg`
 * Pool (src/lib/db/prisma.ts — not shared with Prisma Client) instead of
 * through Prisma Client / @prisma/adapter-pg.
 *
 * ROOT CAUSE OF THE "HANG" — FOUND: it was never Postgres, the network,
 * Prisma, or pg Pool bookkeeping. This function's previous diagnostic
 * version logged 4 separate console.error lines per record (connect /
 * query / release / pool-stats). A single day of HEART_RATE data alone is
 * 700+ records — 2800+ log lines emitted in well under a second. Node's
 * stdout/stderr are SYNCHRONOUS, BLOCKING writes when attached to a pipe on
 * Linux, which is exactly what a container's stdout is. Live testing
 * caught it in the act: Railway logged "rate limit of 500 logs/sec
 * reached... Messages dropped: 3101" and the worker's own log stream went
 * completely silent at that exact instant — no more log lines, ever, from
 * a process that had just been emitting hundreds per second. Once the
 * pipe's kernel buffer filled and Railway's collector stopped draining it
 * fast enough, the next console.error() call blocked forever waiting for
 * buffer space that was never coming back. That freezes the ENTIRE Node
 * event loop, not just I/O — including every `setTimeout` this codebase
 * had already added as a backstop (the 15s per-query timeout below, the
 * 4-minute per-job timeout in sync-job-runner.service.ts): a frozen event
 * loop cannot run a timer callback no matter how it's configured, which is
 * exactly why neither backstop had ever fired despite very long real
 * hangs. It also explains every other symptom collected across this
 * investigation: zero CPU (blocked in a syscall, not spinning), zero rows
 * in pg_stat_activity and TCP connections sitting ESTABLISHED-but-idle
 * (correct — the process never got as far as dispatching the next query;
 * it froze mid-write of the *previous* query's own completion log).
 *
 * Fix: never log per record in a loop that can run into the hundreds or
 * thousands of iterations, full stop. storeRawRecords now logs exactly
 * once per call — a single summary line — plus an occasional warning only
 * when an individual connect()/query() step is slow enough to be
 * suspicious. Both are bounded and can never approach a logs/sec cap
 * regardless of batch size.
 */

const DB_QUERY_TIMEOUT_MS = 15_000;
const SLOW_STEP_WARN_MS = 1_000;

// A hard, unconditional backstop: `pg`'s own configured timeouts
// (statement_timeout, query_timeout, connectionTimeoutMillis in prisma.ts)
// only start counting once a query is actually dispatched over an
// established connection, or once the pool has decided to open a new one.
// They do nothing for a query stuck queued *inside the pool*, waiting for
// a client to free up. This wraps any dbPool call in a plain setTimeout
// race so it rejects on its own schedule no matter what layer is stuck —
// note this itself cannot fire if the event loop is frozen (see the
// top-of-file comment); it only helps for an actual stuck DB call.
function withQueryTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `storeRawRecords: "${label}" did not complete within ${DB_QUERY_TIMEOUT_MS}ms — ` +
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

/**
 * connect() + query() + release(), with logging strictly bounded: a
 * warning line only when a step is slow enough to be worth knowing about,
 * never one per call. See this file's top comment for why per-call logging
 * here was itself the cause of a very real, very confusing production
 * outage.
 */
async function runQuery<T>(label: string, sql: string, values: unknown[]): Promise<{ rows: T[] }> {
  const t0 = Date.now();
  const client = await withQueryTimeout(dbPool.connect(), `${label} connect()`);
  const connectMs = Date.now() - t0;
  if (connectMs > SLOW_STEP_WARN_MS) {
    // eslint-disable-next-line no-console -- deliberately not routed through
    // the app's structured logger: this can fire outside any request/job
    // context, and it's rare enough by design not to need one.
    console.error(
      `[db] ${label}: slow pool checkout (${connectMs}ms) — total=${dbPool.totalCount} idle=${dbPool.idleCount} waiting=${dbPool.waitingCount}`,
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

export async function storeRawRecords(params: {
  userId: string;
  connectionId: string;
  provider: WearableProviderId;
  records: ProviderRawRecord[];
}): Promise<{ created: number; updated: number }> {
  if (params.records.length === 0) {
    return { created: 0, updated: 0 };
  }

  const t0 = Date.now();

  // One bulk read to know, per record, whether it already exists — so the
  // upserts below can report accurate created/updated counts. This is a
  // point-in-time check, not a lock: a genuine race on the exact same
  // (connectionId, dataType, externalId) triple would just make the count
  // slightly off, never a duplicate row — the DB's unique index is what
  // actually guarantees idempotency.
  //
  // Scoped by (connectionId, dataType IN (...)) rather than a per-record
  // OR of exact (dataType, externalId) pairs: a sync batch can carry
  // hundreds of records (a day of heart-rate data alone is 700+), and a
  // per-record OR array was observed in production to make this query take
  // a very long time to plan/execute. Filtering on the handful of distinct
  // data types in this batch instead pulls a superset of existing keys
  // (cheap: two narrow columns, no payload) and the exact match still
  // happens in memory below.
  const dataTypes = Array.from(new Set(params.records.map((record) => record.dataType)));
  const { rows: existing } = await runQuery<{ dataType: string; externalId: string }>(
    'existence check',
    `select "dataType", "externalId"
       from wearable_raw_records
      where "connectionId" = $1
        and "dataType" = any($2::"WearableDataType"[])`,
    [params.connectionId, dataTypes],
  );
  const existingKeys = new Set(existing.map((row) => `${row.dataType}:${row.externalId}`));

  // Upserts run strictly one at a time, deliberately NOT concurrently — see
  // this file's git history for why concurrent Prisma/adapter-pg calls
  // used to hang; nothing since has shown concurrent raw SQL through this
  // pool to be safe enough to revisit that.
  let created = 0;
  let updated = 0;
  for (const record of params.records) {
    const key = `${record.dataType}:${record.externalId}`;
    // eslint-disable-next-line no-await-in-loop -- intentionally sequential; see comment above
    await runQuery(
      `upsert ${record.dataType}:${record.externalId}`,
      `insert into wearable_raw_records
         (id, "userId", "connectionId", provider, "dataType", "externalId", "dataDate", payload, "fetchedAt")
       values ($1, $2, $3, $4::"WearableProvider", $5::"WearableDataType", $6, $7::date, $8::jsonb, now())
       on conflict ("connectionId", "dataType", "externalId")
       do update set "dataDate" = excluded."dataDate", payload = excluded.payload, "fetchedAt" = now()`,
      [
        randomUUID(),
        params.userId,
        params.connectionId,
        params.provider,
        record.dataType,
        record.externalId,
        record.dataDate,
        // `payload` is deliberately typed `unknown` at this boundary (see
        // ProviderRawRecord above) — every provider mapper already produces
        // JSON-serializable data, so a plain JSON.stringify is safe here.
        JSON.stringify(record.payload),
      ],
    );
    if (existingKeys.has(key)) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  // Exactly one summary line per call, regardless of batch size — see this
  // file's top comment for why per-record logging here is off-limits.
  // eslint-disable-next-line no-console -- deliberate, bounded diagnostic output
  console.error(
    `[db] storeRawRecords done: connectionId=${params.connectionId} records=${params.records.length} ` +
      `dataTypes=${dataTypes.join(',')} created=${created} updated=${updated} elapsedMs=${Date.now() - t0}`,
  );

  return { created, updated };
}
