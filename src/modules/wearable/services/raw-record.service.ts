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
 * @prisma/adapter-pg. That's not a style choice: every previous attempt at
 * making this table's sync writes work through Prisma -- the bundled Rust
 * query engine, then @prisma/adapter-pg run concurrently, then
 * @prisma/adapter-pg run fully sequentially -- hung forever on the very
 * first query issued against wearable_raw_records, every single time,
 * reproduced across four separate live sync attempts in a row. In the same
 * attempts, sync.service.ts's *other* Prisma call against a different table
 * (ensureFreshAccessToken's read of wearable_connections, still going
 * through the same PrismaClient/adapter/pool) kept succeeding in single-digit
 * milliseconds every time. Live inspection during a hang showed
 * pg_stat_activity had ZERO rows from the app at all -- the freeze happens
 * before any query for this table ever reaches Postgres, i.e. somewhere in
 * Prisma Client's or the adapter's own request-building/dispatch path for
 * this specific query shape (large IN-array parameter and/or the compound
 * upsert), not in Postgres, not on the network, and not from concurrency.
 * Since the underlying `pg` Pool is proven fine -- it's the exact same pool
 * ensureFreshAccessToken's Prisma query uses, successfully, on every
 * attempt -- going straight through it with hand-written SQL sidesteps
 * whatever in Prisma Client / @prisma/adapter-pg was hanging. If this ever
 * needs to move back to Prisma, do it as its own follow-up with a live
 * verified sync, not bundled into an unrelated change.
 */
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
  const { rows: existing } = await dbPool.query<{ dataType: string; externalId: string }>(
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
    await dbPool.query(
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
