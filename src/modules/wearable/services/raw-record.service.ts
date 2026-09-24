import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { ProviderRawRecord, WearableProviderId } from '../domain/wearable-provider.types';

/**
 * ARCHITECTURE.md §7.6: `WearableRawRecord` is unique on
 * `(connectionId, dataType, externalId)` — any retry, at any layer, upserts
 * rather than duplicates. This is the ONLY function that writes
 * WearableRawRecord; nothing here interprets `payload` (it's opaque JSON
 * all the way through) — that's oura-mappers.ts's job, one layer up.
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
  // upserts below can report accurate created/updated counts (Prisma's
  // upsert result doesn't say which branch fired). This is a point-in-time
  // check, not a lock: a genuine race on the exact same (connectionId,
  // dataType, externalId) triple would just make the count slightly off,
  // never a duplicate row — the DB's unique constraint is what actually
  // guarantees idempotency.
  //
  // Scoped by (connectionId, dataType IN (...)) rather than a per-record
  // OR of exact (dataType, externalId) pairs: a sync batch can carry
  // hundreds of records (a day of heart-rate data alone is 700+), and a
  // Prisma `OR` array of that size was observed in production to make this
  // query take a very long time to plan/execute — long enough that syncs
  // with a large heart-rate page never finished within the job's hard
  // timeout. Filtering on the handful of distinct data types in this batch
  // instead pulls a superset of existing keys (cheap: two narrow columns,
  // no payload) and the exact match still happens in memory below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing: any[] = await prisma.wearableRawRecord.findMany({
    where: {
      connectionId: params.connectionId,
      dataType: { in: Array.from(new Set(params.records.map((record) => record.dataType))) },
    },
    select: { dataType: true, externalId: true },
  });
  const existingKeys = new Set(existing.map((row) => `${row.dataType}:${row.externalId}`));

  // Upserts run strictly one at a time, deliberately NOT concurrently.
  // Production testing on this app (with @prisma/adapter-pg, the
  // node-postgres driver adapter) showed that issuing several Prisma
  // queries at once through this adapter can hang forever: `pg_stat_activity`
  // during the hang showed each connection sitting `idle` with
  // `wait_event: ClientRead` — Postgres had already answered every query,
  // but the responses never made it back out of the engine/adapter bridge
  // to Node. It reproduced reliably with as few as 10 concurrent upserts
  // and never happened with sequential ones. Until that adapter bug is
  // resolved upstream, every Prisma call in the sync write path (here and
  // in sync.service.ts) is kept strictly sequential — slower per record,
  // but it actually finishes.
  let created = 0;
  let updated = 0;
  for (const record of params.records) {
    const key = `${record.dataType}:${record.externalId}`;
    // eslint-disable-next-line no-await-in-loop -- intentionally sequential; see comment above
    await prisma.wearableRawRecord.upsert({
      where: {
        uniq_raw_record: {
          connectionId: params.connectionId,
          dataType: record.dataType,
          externalId: record.externalId,
        },
      },
      create: {
        userId: params.userId,
        connectionId: params.connectionId,
        provider: params.provider,
        dataType: record.dataType,
        externalId: record.externalId,
        dataDate: record.dataDate,
        // `payload` is deliberately typed `unknown` at this boundary (see
        // ProviderRawRecord above) — every provider mapper already produces
        // JSON-serializable data, so this cast just tells Prisma's
        // InputJsonValue what TypeScript can't infer through `unknown`.
        payload: record.payload as Prisma.InputJsonValue,
      },
      update: {
        dataDate: record.dataDate,
        payload: record.payload as Prisma.InputJsonValue,
        fetchedAt: new Date(),
      },
    });
    if (existingKeys.has(key)) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return { created, updated };
}
