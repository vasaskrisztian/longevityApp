import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  wearableRawRecord: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const { storeRawRecords } = await import('@/modules/wearable/services/raw-record.service');

const DAY = new Date('2026-01-15T00:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('storeRawRecords', () => {
  it('is a no-op returning zero counts when there are no records', async () => {
    const result = await storeRawRecords({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      records: [],
    });

    expect(result).toEqual({ created: 0, updated: 0 });
    expect(prismaMock.wearableRawRecord.findMany).not.toHaveBeenCalled();
    expect(prismaMock.wearableRawRecord.upsert).not.toHaveBeenCalled();
  });

  it('upserts each record keyed on the compound (connectionId, dataType, externalId) constraint', async () => {
    prismaMock.wearableRawRecord.findMany.mockResolvedValue([]);
    prismaMock.wearableRawRecord.upsert.mockResolvedValue({});

    await storeRawRecords({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY, payload: { score: 80 } }],
    });

    expect(prismaMock.wearableRawRecord.upsert).toHaveBeenCalledWith({
      where: { uniq_raw_record: { connectionId: 'conn-1', dataType: 'DAILY_SLEEP', externalId: 's1' } },
      create: {
        userId: 'u1',
        connectionId: 'conn-1',
        provider: 'OURA',
        dataType: 'DAILY_SLEEP',
        externalId: 's1',
        dataDate: DAY,
        payload: { score: 80 },
      },
      update: { dataDate: DAY, payload: { score: 80 }, fetchedAt: expect.any(Date) },
    });
  });

  it('counts a record with no matching existing row as created', async () => {
    prismaMock.wearableRawRecord.findMany.mockResolvedValue([]);
    prismaMock.wearableRawRecord.upsert.mockResolvedValue({});

    const result = await storeRawRecords({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY, payload: {} }],
    });

    expect(result).toEqual({ created: 1, updated: 0 });
  });

  it('counts a record with a matching existing (dataType, externalId) row as updated', async () => {
    prismaMock.wearableRawRecord.findMany.mockResolvedValue([
      { dataType: 'DAILY_SLEEP', externalId: 's1' },
    ]);
    prismaMock.wearableRawRecord.upsert.mockResolvedValue({});

    const result = await storeRawRecords({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY, payload: {} }],
    });

    expect(result).toEqual({ created: 0, updated: 1 });
  });

  it('handles a mixed batch of new and existing records, counting each correctly', async () => {
    prismaMock.wearableRawRecord.findMany.mockResolvedValue([
      { dataType: 'DAILY_SLEEP', externalId: 's1' },
    ]);
    prismaMock.wearableRawRecord.upsert.mockResolvedValue({});

    const result = await storeRawRecords({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      records: [
        { dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY, payload: {} },
        { dataType: 'DAILY_READINESS', externalId: 'r1', dataDate: DAY, payload: {} },
      ],
    });

    expect(result).toEqual({ created: 1, updated: 1 });
    expect(prismaMock.wearableRawRecord.upsert).toHaveBeenCalledTimes(2);
  });

  it('scopes the existence check to the connectionId and every (dataType, externalId) pair in the batch', async () => {
    prismaMock.wearableRawRecord.findMany.mockResolvedValue([]);
    prismaMock.wearableRawRecord.upsert.mockResolvedValue({});

    const records = [
      { dataType: 'DAILY_SLEEP' as const, externalId: 's1', dataDate: DAY, payload: {} },
      { dataType: 'SPO2' as const, externalId: 'sp1', dataDate: DAY, payload: {} },
    ];
    await storeRawRecords({ userId: 'u1', connectionId: 'conn-1', provider: 'OURA', records });

    expect(prismaMock.wearableRawRecord.findMany).toHaveBeenCalledWith({
      where: {
        connectionId: 'conn-1',
        OR: [
          { dataType: 'DAILY_SLEEP', externalId: 's1' },
          { dataType: 'SPO2', externalId: 'sp1' },
        ],
      },
      select: { dataType: true, externalId: true },
    });
  });
});
