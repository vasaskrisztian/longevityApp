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
 * Pool (src/lib/db/prisma.ts — not shared with Prisma Client any more)
 * instead of through Prisma Client / @prisma/adapter-pg. History,
 * shortest version: the bundled Rust query engine, then
 * @prisma/adapter-pg run concurrently, then @prisma/adapter-pg run fully
 * sequentially, then hand-written SQL through a Pool SHARED with Prisma's
 * adapter, then that same SQL through its own dedicated Pool — ALL hung
 * forever at the exact same point (the first query against
 * wearable_raw_records), even immediately after a fresh deploy's very
 * first sync attempt. Every live hang: pg_stat_activity showed ZERO rows
 * from the app during the hang; a manual reproduction of this exact query
 * through a brand-new ad hoc pg.Pool in the same container completed in
 * under 100ms; and a live `/proc/<pid>/net/tcp` inspection of the actual
 * hung worker process during a hang found TWO already-ESTABLISHED
 * connections to Postgres with EMPTY send/receive queues on both — i.e.
 * the TCP connection exists, nothing is in flight either direction, and
 * nothing ever arrives. That combination is not explained by Postgres,
 * the network, TLS (this connection doesn't use it), or pool
 * exhaustion/bookkeeping alone — it points at something in the JS-level
 * handoff between `pg`'s Pool/Client and its socket layer never actually
 * happening for this call, in this process, on this runtime.
 *
 * DIAGNOSTIC INSTRUMENTATION (temporary, see loggedConnect/loggedQuery
 * below): logs pool stats and explicit connect()/query()/release() steps
 * with elapsed time at each one, so the next live hang's Railway logs show
 * exactly which step never returns — pool.connect() itself (no client
 * available / checkout hangs) vs. a query issued on an already-acquired
 * client (checkout is fine, the query round-trip itself hangs). Remove
 * once the actual failing step is identified and fixed at its source;
 * don't let this permanently replace the plain pool.query() calls it
 * wraps.
 */

const DB_QUERY_TIMEOUT_MS = 15_000;

// A hard, unconditional backstop against exactly the failure class
// described above: `pg`'s own configured timeouts (statement_timeout,
// query_timeout, connectionTimeoutMillis in prisma.ts) only start counting
// once a query is actually dispatched over an established connection, or
// once the pool has decided to open a new one. They do nothing for a
// query that's stuck queued *inside the pool*, waiting for a client to
// free up, which is the state every live hang so far is consistent with.
// This wraps any dbPool call in a plain setTimeout race so it rejects on
// its own schedule no matter what layer is actually stuck.
function withQueryTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `storeRawRecords: "${label}" did not complete within ${DB_QUERY_TIMEOUT_MS}ms — ` +
            `treating this as a hung pg call (see raw-record.service.ts's top comment) ` +
            `rather than waiting forever.`,
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

function logPoolStats(label: string): void {
  // eslint-disable-next-line no-console -- deliberate diagnostic output, see top comment
  console.error(
    `[db diag] ${label} pool stats: total=${dbPool.totalCount} idle=${dbPool.idleCount} waiting=${dbPool.waitingCount}`,
  );
}

/**
 * Explicit connect()+query()+release(), replacing the `dbPool.query(...)`
 * convenience wrapper for the diagnostic window — that convenience method
 * does exactly this internally, but logging each step separately is the
 * only way to see, from Railway's logs, whether a hang is stuck acquiring
 * a client at all or stuck on the query round-trip after a client was
 * already handed out.
 */
async function loggedQuery<T>(
  label: string,
  sql: string,
  values: unknown[],
): Promise<{ rows: T[] }> {
  const t0 = Date.now();
  logPoolStats(`${label}: before connect`);
  // eslint-disable-next-line no-console -- diagnostic
  console.error(`[db diag] ${label}: calling dbPool.connect()`);
  const client = await withQueryTimeout(dbPool.connect(), `${label} connect()`);
  // eslint-disable-next-line no-console -- diagnostic
  console.error(`[db diag] ${label}: connect() resolved after ${Date.now() - t0}ms`);
  logPoolStats(`${label}: after connect`);
  try {
    const t1 = Date.now();
    // eslint-disable-next-line no-console -- diagnostic
    console.error(`[db diag] ${label}: calling client.query()`);
    const result = await withQueryTimeout(client.query(sql, values), `${label} query()`);
    // eslint-disable-next-line no-console -- diagnostic
    console.error(`[db diag] ${label}: client.query() resolved after ${Date.now() - t1}ms, rowCount=${result.rowCount}`);
    return result as { rows: T[] };
  } finally {
    client.release();
    // eslint-disable-next-line no-console -- diagnostic
    console.error(`[db diag] ${label}: client released, total elapsed ${Date.now() - t0}ms`);
    logPoolStats(`${label}: after release`);
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
  const { rows: existing } = await loggedQuery<{ dataType: string; externalId: string }>(
    'existence check',
    `select "dataType", "externalId"
       from wearable_raw_records
      where "connectionId" = $1
        and "dataType" = any($2::"WearableDataType"[])`,
    [params.connectionId, dataTypes],
  );
  const existingKeys = new Set(existing.map((row) => `${row.dataType}:${row.externalId}`));

  // Upserts run strictly one at a time, deliberately NOT concurrently —
  // even though this no longer goes through the Prisma adapter that
  // motivated that rule, there's no reason yet to believe issuing many
  // queries at once through this same shared pg Pool is safe under load,
  // and sequential is what's been verified to work.
  let created = 0;
  let updated = 0;
  for (const record of params.records) {
    const key = `${record.dataType}:${record.externalId}`;
    // eslint-disable-next-line no-await-in-loop -- intentionally sequential; see comment above
    await loggedQuery(
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

  return { created, updated };
}
