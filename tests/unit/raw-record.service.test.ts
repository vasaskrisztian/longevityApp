import { describe, it, expect, vi, beforeEach } from 'vitest';

const clientMock = {
  query: vi.fn(),
  release: vi.fn(),
};
const poolMock = {
  connect: vi.fn(),
  totalCount: 1,
  idleCount: 1,
  waitingCount: 0,
};
vi.mock('@/lib/db/prisma', () => ({ dbPool: poolMock }));

const { storeRawRecords } = await import('@/modules/wearable/services/raw-record.service');

const DAY = new Date('2026-01-15T00:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  poolMock.connect.mockResolvedValue(clientMock);
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
    expect(poolMock.connect).not.toHaveBeenCalled();
    expect(clientMock.query).not.toHaveBeenCalled();
  });

  it('upserts each record keyed on the compound (connectionId, dataType, externalId) constraint', async () => {
    clientMock.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await storeRawRecords({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY, payload: { score: 80 } }],
    });

    // One client checked out for the whole call (see run-query.ts's top
    // comment for why per-query checkout used to be the real hang) --
    // first query is the existence check, second is the upsert, both
    // against that single client.
    expect(poolMock.connect).toHaveBeenCalledTimes(1);
    expect(clientMock.query).toHaveBeenCalledTimes(2);
    expect(clientMock.release).toHaveBeenCalledTimes(1);
    const [upsertSql, upsertParams] = clientMock.query.mock.calls[1]!;
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
    clientMock.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await storeRawRecords({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY, payload: {} }],
    });

    expect(result).toEqual({ created: 1, updated: 0 });
  });

  it('counts a record with a matching existing (dataType, externalId) row as updated', async () => {
    clientMock.query.mockResolvedValueOnce({ rows: [{ dataType: 'DAILY_SLEEP', externalId: 's1' }], rowCount: 1 });
    clientMock.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await storeRawRecords({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY, payload: {} }],
    });

    expect(result).toEqual({ created: 0, updated: 1 });
  });

  it('handles a mixed batch of new and existing records, counting each correctly', async () => {
    clientMock.query.mockResolvedValueOnce({ rows: [{ dataType: 'DAILY_SLEEP', externalId: 's1' }], rowCount: 1 });
    clientMock.query.mockResolvedValue({ rows: [], rowCount: 0 });

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
    // 1 existence check + 2 upserts, all against the one checked-out client.
    expect(poolMock.connect).toHaveBeenCalledTimes(1);
    expect(clientMock.query).toHaveBeenCalledTimes(3);
  });

  it('scopes the existence check to the connectionId and the distinct data types in the batch', async () => {
    // Scoped by dataType IN (...) rather than a per-record OR of exact
    // (dataType, externalId) pairs: a large batch (hundreds of heart-rate
    // records) turned that OR array into a query slow enough to blow past
    // the sync job's hard timeout in production. See raw-record.service.ts.
    clientMock.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const records = [
      { dataType: 'DAILY_SLEEP' as const, externalId: 's1', dataDate: DAY, payload: {} },
      { dataType: 'SPO2' as const, externalId: 'sp1', dataDate: DAY, payload: {} },
      { dataType: 'SPO2' as const, externalId: 'sp2', dataDate: DAY, payload: {} },
    ];
    await storeRawRecords({ userId: 'u1', connectionId: 'conn-1', provider: 'OURA', records });

    const [existenceSql, existenceParams] = clientMock.query.mock.calls[0]!;
    expect(existenceSql).toMatch(/select "dataType", "externalId"/i);
    expect(existenceSql).toMatch(/"dataType" = any\(\$2::"WearableDataType"\[\]\)/i);
    expect(existenceParams).toEqual(['conn-1', ['DAILY_SLEEP', 'SPO2']]);
  });

  it('processes a large batch without dropping any record, one upsert at a time, on a single checked-out client', async () => {
    clientMock.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const records = Array.from({ length: 63 }, (_, i) => ({
      dataType: 'HEART_RATE' as const,
      externalId: `hr-${i}`,
      dataDate: DAY,
      payload: {},
    }));

    const result = await storeRawRecords({ userId: 'u1', connectionId: 'conn-1', provider: 'OURA', records });

    expect(result).toEqual({ created: 63, updated: 0 });
    // 1 existence check + 63 upserts, but only ONE connect()/release() —
    // see run-query.ts's top comment for why per-query checkout is exactly
    // what this test now guards against regressing to.
    expect(poolMock.connect).toHaveBeenCalledTimes(1);
    expect(clientMock.query).toHaveBeenCalledTimes(64);
    expect(clientMock.release).toHaveBeenCalledTimes(1);
  });

  it('releases the client even when a query rejects partway through the batch', async () => {
    clientMock.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // existence check
    clientMock.query.mockRejectedValueOnce(new Error('boom')); // first upsert fails

    await expect(
      storeRawRecords({
        userId: 'u1',
        connectionId: 'conn-1',
        provider: 'OURA',
        records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY, payload: {} }],
      }),
    ).rejects.toThrow('boom');

    expect(clientMock.release).toHaveBeenCalledTimes(1);
  });
});
