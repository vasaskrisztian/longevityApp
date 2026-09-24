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
 * This talks to Postgres directly through the shared `pg` Pool
 * (`dbPool`, from src/lib/db/prisma.ts) instead of through Prisma Client /
 * @prisma/adapter-pg. History, shortest version: the bundled Rust query
 * engine, then @prisma/adapter-pg run concurrently, then @prisma/adapter-pg
 * run fully sequentially, ALL hung forever on the very first query issued
 * against wearable_raw_records — but so did this hand-written raw-`pg`
 * version, on live re-test, with an identical symptom: pg_stat_activity
 * showed ZERO rows from the app during the hang, every single time,
 * regardless of which DB layer issued the query. Zero rows means the
 * freeze isn't in Prisma, the adapter, Postgres, or the network at all —
 * it's Node never even reaching the point of dispatching a query. The
 * leading explanation (see prisma.ts's `pool.on('error', ...)` comment): a
 * `pg` client that dies while idle in the pool without the pool being told
 * can leave a phantom "in use" slot with no real connection behind it, and
 * `pg` has no default timeout for a query that's queued waiting on a pool
 * slot (only for establishing a brand-new connection) — so it waits
 * forever. Two layers of defense here, since we can't yet prove which one
 * actually fixes it without another live sync: prisma.ts's error listener
 * aims at the suspected cause, and `withQueryTimeout` below is a hard
 * backstop so that even if some other, still-unknown hang class exists,
 * this function fails fast and lets BullMQ's existing retry policy take
 * over instead of leaving the job (and the user) stuck forever. If this
 * ever needs to move back to Prisma, do it as its own follow-up with a
 * live verified sync, not bundled into an unrelated change.
 */

const DB_QUERY_TIMEOUT_MS = 15_000;

// A hard, unconditional backstop against exactly the failure class
// described above: `pg`'s own configured timeouts (statement_timeout,
// query_timeout, connectionTimeoutMillis in prisma.ts) only start counting
// once a query is actually dispatched over an established connection, or
// once the pool has decided to open a new one. They do nothing for a
// query that's stuck queued *inside the pool*, waiting for a client to
// free up, which is the state every live hang so far is consistent with.
// This wraps any dbPool.query() call in a plain setTimeout race so it
// rejects on its own schedule no matter what layer is actually stuck.
function withQueryTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `storeRawRecords: "${label}" query did not complete within ${DB_QUERY_TIMEOUT_MS}ms — ` +
            `treating this as a hung pg Pool checkout (see raw-record.service.ts's top comment) ` +
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
  const { rows: existing } = await withQueryTimeout(
    dbPool.query<{ dataType: string; externalId: string }>(
      `select "dataType", "externalId"
         from wearable_raw_records
        where "connectionId" = $1
          and "dataType" = any($2::"WearableDataType"[])`,
      [params.connectionId, dataTypes],
    ),
    'existence check',
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
    await withQueryTimeout(
      dbPool.query(
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
      ),
      `upsert ${record.dataType}:${record.externalId}`,
    );
    if (existingKeys.has(key)) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return { created, updated };
}
