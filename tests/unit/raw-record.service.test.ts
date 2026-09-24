import { describe, it, expect, vi, beforeEach } from 'vitest';

const poolMock = {
  query: vi.fn(),
};
vi.mock('@/lib/db/prisma', () => ({ dbPool: poolMock }));

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
    expect(poolMock.query).not.toHaveBeenCalled();
  });

  it('upserts each record keyed on the compound (connectionId, dataType, externalId) constraint', async () => {
    poolMock.query.mockResolvedValue({ rows: [] });

    await storeRawRecords({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY, payload: { score: 80 } }],
    });

    // First call is the existence check, second is the upsert.
    expect(poolMock.query).toHaveBeenCalledTimes(2);
    const [upsertSql, upsertParams] = poolMock.query.mock.calls[1]!;
    expect(upsertSql).toMatch(/insert into wearable_raw_records/i);
    expect(upsertSql).toMatch(/on conflict \("connectionId", "dataType", "externalId"\)/i);
    expect(upsertParams).toEqual([
      expect.any(String),
      'u1',
      'conn-1',
      'OURA',
      'DAILY_SLEEP',
      's1',
      DAY,
      JSON.stringify({ score: 80 }),
    ]);
  });

  it('counts a record with no matching existing row as created', async () => {
    poolMock.query.mockResolvedValue({ rows: [] });

    const result = await storeRawRecords({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY, payload: {} }],
    });

    expect(result).toEqual({ created: 1, updated: 0 });
  });

  it('counts a record with a matching existing (dataType, externalId) row as updated', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [{ dataType: 'DAILY_SLEEP', externalId: 's1' }] });
    poolMock.query.mockResolvedValueOnce({ rows: [] });

    const result = await storeRawRecords({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY, payload: {} }],
    });

    expect(result).toEqual({ created: 0, updated: 1 });
  });

  it('handles a mixed batch of new and existing records, counting each correctly', async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [{ dataType: 'DAILY_SLEEP', externalId: 's1' }] });
    poolMock.query.mockResolvedValue({ rows: [] });

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
    // 1 existence check + 2 upserts.
    expect(poolMock.query).toHaveBeenCalledTimes(3);
  });

  it('scopes the existence check to the connectionId and the distinct data types in the batch', async () => {
    // Scoped by dataType IN (...) rather than a per-record OR of exact
    // (dataType, externalId) pairs: a large batch (hundreds of heart-rate
    // records) turned that OR array into a query slow enough to blow past
    // the sync job's hard timeout in production. See raw-record.service.ts.
    poolMock.query.mockResolvedValue({ rows: [] });

    const records = [
      { dataType: 'DAILY_SLEEP' as const, externalId: 's1', dataDate: DAY, payload: {} },
      { dataType: 'SPO2' as const, externalId: 'sp1', dataDate: DAY, payload: {} },
      { dataType: 'SPO2' as const, externalId: 'sp2', dataDate: DAY, payload: {} },
    ];
    await storeRawRecords({ userId: 'u1', connectionId: 'conn-1', provider: 'OURA', records });

    const [existenceSql, existenceParams] = poolMock.query.mock.calls[0]!;
    expect(existenceSql).toMatch(/select "dataType", "externalId"/i);
    expect(existenceSql).toMatch(/"dataType" = any\(\$2::"WearableDataType"\[\]\)/i);
    expect(existenceParams).toEqual(['conn-1', ['DAILY_SLEEP', 'SPO2']]);
  });

  it('processes a large batch without dropping any record, one upsert at a time', async () => {
    poolMock.query.mockResolvedValue({ rows: [] });

    const records = Array.from({ length: 63 }, (_, i) => ({
      dataType: 'HEART_RATE' as const,
      externalId: `hr-${i}`,
      dataDate: DAY,
      payload: {},
    }));

    const result = await storeRawRecords({ userId: 'u1', connectionId: 'conn-1', provider: 'OURA', records });

    expect(result).toEqual({ created: 63, updated: 0 });
    // 1 existence check + 63 upserts.
    expect(poolMock.query).toHaveBeenCalledTimes(64);
  });
});
