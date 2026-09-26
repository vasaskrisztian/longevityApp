import { randomUUID } from 'node:crypto';
import { dbPool } from '@/lib/db/prisma';
import { withClient } from '@/lib/db/run-query';
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
 * WHY RAW SQL HERE AT ALL: see this repo's git history for the long trail,
 * but the short version is that Prisma Client / @prisma/adapter-pg calls in
 * this sync write path have repeatedly hung forever with zero trace in
 * Postgres, and every attempt at bypassing Prisma for a given call has
 * fixed that specific call.
 *
 * WHY ONE CLIENT FOR THE WHOLE BATCH (not connect()+release() per record):
 * see run-query.ts's top comment for the full story — that per-record
 * cycling pattern turned out to be the real, final root cause of the sync
 * write path's long-standing hang, reproduced on two consecutive scheduled
 * runs. `withClient` below checks out exactly one client for this entire
 * call, every upsert in the loop reuses it, and it's released once at the
 * end.
 *
 * A SEPARATE, already-fixed bug: an earlier version of this function
 * logged 4 separate console.error lines per record. A single day of
 * HEART_RATE data alone is 700+ records — 2800+ log lines emitted in well
 * under a second. Node's stdout/stderr are synchronous, blocking writes
 * when attached to a pipe on Linux (exactly what a container's stdout is),
 * and live testing caught Railway's own collector rate-limiting and
 * dropping messages at that volume, at the exact moment the worker's log
 * stream went dead. Once the pipe's kernel buffer fills and isn't being
 * drained fast enough, the next console.error() call blocks forever —
 * which freezes the entire Node event loop, including every setTimeout
 * backstop. This function logs exactly once per call, regardless of batch
 * size.
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

  const t0 = Date.now();

  return withClient(dbPool, `storeRawRecords ${params.connectionId}`, async (query) => {
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
    const { rows: existing } = await query(
      `select "dataType", "externalId"
         from wearable_raw_records
        where "connectionId" = $1
          and "dataType" = any($2::"WearableDataType"[])`,
      [params.connectionId, dataTypes],
    );
    const existingKeys = new Set(
      (existing as Array<{ dataType: string; externalId: string }>).map((row) => `${row.dataType}:${row.externalId}`),
    );

    // Upserts run strictly one at a time against the single checked-out
    // client, deliberately NOT concurrently — see this file's git history
    // for why concurrent Prisma/adapter-pg calls used to hang; nothing
    // since has shown concurrent raw SQL to be safe enough to revisit that.
    let created = 0;
    let updated = 0;
    for (const record of params.records) {
      const key = `${record.dataType}:${record.externalId}`;
      // eslint-disable-next-line no-await-in-loop -- intentionally sequential; see comment above
      await query(
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
  });
}
