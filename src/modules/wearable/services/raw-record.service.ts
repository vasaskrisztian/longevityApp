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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing: any[] = await prisma.wearableRawRecord.findMany({
    where: {
      connectionId: params.connectionId,
      OR: params.records.map((record) => ({
        dataType: record.dataType,
        externalId: record.externalId,
      })),
    },
    select: { dataType: true, externalId: true },
  });
  const existingKeys = new Set(existing.map((row) => `${row.dataType}:${row.externalId}`));

  let created = 0;
  let updated = 0;
  for (const record of params.records) {
    const key = `${record.dataType}:${record.externalId}`;
    // eslint-disable-next-line no-await-in-loop -- sequential upserts keep created/updated accounting simple and deterministic; ingestion volume here is small (dozens to low hundreds of rows per sync)
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
