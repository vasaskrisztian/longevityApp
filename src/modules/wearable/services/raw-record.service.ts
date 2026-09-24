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

  // Upserts run with bounded concurrency instead of one at a time: a fully
  // sequential `for` loop over a large batch (again, heart-rate data can be
  // 700+ records for a single day) pays a full round trip per record and
  // was the other big contributor to syncs overrunning the hard timeout.
  // A chunk size of 25 keeps well under the DB pool size while cutting
  // total wall time by roughly the chunk factor.
  const CONCURRENCY = 25;
  let created = 0;
  let updated = 0;
  for (let i = 0; i < params.records.length; i += CONCURRENCY) {
    const chunk = params.records.slice(i, i + CONCURRENCY);
    // eslint-disable-next-line no-await-in-loop -- intentional: chunks run concurrently within themselves, but chunks are processed one after another to keep peak DB-connection usage bounded
    await Promise.all(
      chunk.map(async (record) => {
        const key = `${record.dataType}:${record.externalId}`;
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
      }),
    );
  }

  return { created, updated };
}
