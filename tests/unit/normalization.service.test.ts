import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WearableProviderAdapter } from '@/modules/wearable/domain/wearable-provider.types';

// normalizeAndUpsertDailyMetrics/normalizeAndUpsertWorkouts talk to Postgres
// directly through dbPool via withClient's single connect()/query()/
// release() cycle per call (see this file's own top comment for why Prisma
// Client, and later per-query checkout, were both removed from this path),
// so these tests mock the pool the same way raw-record.service.test.ts
// does, rather than mocking a Prisma Client shape.
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

const { normalizeAndUpsertDailyMetrics, normalizeAndUpsertWorkouts } = await import(
  '@/modules/wearable/services/normalization.service'
);

const DAY_1 = new Date('2026-01-15T00:00:00Z');
const DAY_2 = new Date('2026-01-16T00:00:00Z');

function fakeAdapter(overrides: Partial<WearableProviderAdapter> = {}): WearableProviderAdapter {
  return {
    id: 'OURA',
    getRedirectUri: () => '',
    buildAuthorizationUrl: () => '',
    exchangeAuthorizationCode: vi.fn(),
    refreshAccessToken: vi.fn(),
    revokeTokens: vi.fn(),
    fetchRawData: vi.fn(),
    mapToNormalizedFields: () => null,
    mapToWorkout: () => null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  poolMock.connect.mockResolvedValue(clientMock);
  clientMock.query.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('normalizeAndUpsertDailyMetrics', () => {
  it('does nothing when the adapter maps every record to null', async () => {
    const adapter = fakeAdapter();
    const result = await normalizeAndUpsertDailyMetrics({
      userId: 'u1',
      provider: 'OURA',
      records: [{ dataType: 'HEART_RATE', externalId: 'hr1', dataDate: DAY_1, payload: {} }],
      adapter,
    });

    expect(result).toEqual({ datesUpserted: 0 });
    expect(poolMock.connect).not.toHaveBeenCalled();
  });

  it('merges two records mapping to the same date into one upsert, carrying both fields', async () => {
    const adapter = fakeAdapter({
      mapToNormalizedFields: (record) => {
        if (record.dataType === 'DAILY_SLEEP') {
          return { date: DAY_1, fields: { sleepScore: 80 } };
        }
        if (record.dataType === 'DAILY_ACTIVITY') {
          return { date: DAY_1, fields: { steps: 5000 } };
        }
        return null;
      },
    });

    const result = await normalizeAndUpsertDailyMetrics({
      userId: 'u1',
      provider: 'OURA',
      records: [
        { dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY_1, payload: {} },
        { dataType: 'DAILY_ACTIVITY', externalId: 'a1', dataDate: DAY_1, payload: {} },
      ],
      adapter,
    });

    expect(result).toEqual({ datesUpserted: 1 });
    expect(poolMock.connect).toHaveBeenCalledTimes(1);
    expect(clientMock.query).toHaveBeenCalledTimes(1);
    const [sql, values] = clientMock.query.mock.calls[0]!;
    expect(sql).toMatch(/insert into daily_health_metrics/i);
    expect(sql).toMatch(/"sleepScore"/);
    expect(sql).toMatch(/"steps"/);
    expect(values).toEqual([expect.any(String), 'u1', DAY_1, ['OURA'], 80, 5000]);
  });

  it('upserts one row per distinct date when records span multiple days, on a single checked-out client', async () => {
    const adapter = fakeAdapter({
      mapToNormalizedFields: (record) => ({ date: record.dataDate, fields: { sleepScore: 70 } }),
    });

    const result = await normalizeAndUpsertDailyMetrics({
      userId: 'u1',
      provider: 'OURA',
      records: [
        { dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY_1, payload: {} },
        { dataType: 'DAILY_SLEEP', externalId: 's2', dataDate: DAY_2, payload: {} },
      ],
      adapter,
    });

    expect(result).toEqual({ datesUpserted: 2 });
    // Two dates, two upserts, but only ONE connect()/release() — see
    // run-query.ts's top comment for why per-query checkout on this shared
    // pool turned out to be the sync write path's real, final hang.
    expect(poolMock.connect).toHaveBeenCalledTimes(1);
    expect(clientMock.query).toHaveBeenCalledTimes(2);
    expect(clientMock.release).toHaveBeenCalledTimes(1);
  });

  it('merges sourceProviders in SQL rather than a separate read, keeping providers already recorded for that date', async () => {
    const adapter = fakeAdapter({
      mapToNormalizedFields: () => ({ date: DAY_1, fields: { sleepScore: 80 } }),
    });

    await normalizeAndUpsertDailyMetrics({
      userId: 'u1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY_1, payload: {} }],
      adapter,
    });

    // No separate findUnique-style read: exactly one query for the whole date.
    expect(poolMock.connect).toHaveBeenCalledTimes(1);
    expect(clientMock.query).toHaveBeenCalledTimes(1);
    const [sql, values] = clientMock.query.mock.calls[0]!;
    // The merge (and de-dup) of sourceProviders with whatever the row
    // already has happens in Postgres itself via ON CONFLICT, not in JS —
    // this only inserts this call's own contribution.
    expect(sql).toMatch(/"sourceProviders"\s*=\s*ARRAY\(\s*select distinct unnest/i);
    expect(values[3]).toEqual(['OURA']);
  });

  it('upserts keyed on the (userId, date) compound constraint', async () => {
    const adapter = fakeAdapter({
      mapToNormalizedFields: () => ({ date: DAY_1, fields: { sleepScore: 80 } }),
    });

    await normalizeAndUpsertDailyMetrics({
      userId: 'u1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY_1, payload: {} }],
      adapter,
    });

    const [sql, values] = clientMock.query.mock.calls[0]!;
    expect(sql).toMatch(/on conflict \("userId", date\)/i);
    expect(values[1]).toBe('u1');
    expect(values[2]).toBe(DAY_1);
  });

  it('releases the client even when the query rejects', async () => {
    clientMock.query.mockRejectedValueOnce(new Error('boom'));
    const adapter = fakeAdapter({
      mapToNormalizedFields: () => ({ date: DAY_1, fields: { sleepScore: 80 } }),
    });

    await expect(
      normalizeAndUpsertDailyMetrics({
        userId: 'u1',
        provider: 'OURA',
        records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY_1, payload: {} }],
        adapter,
      }),
    ).rejects.toThrow('boom');

    expect(clientMock.release).toHaveBeenCalledTimes(1);
  });
});

describe('normalizeAndUpsertWorkouts', () => {
  it('does nothing when the adapter maps every record to null', async () => {
    const adapter = fakeAdapter();
    const result = await normalizeAndUpsertWorkouts({
      userId: 'u1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY_1, payload: {} }],
      adapter,
    });

    expect(result).toEqual({ workoutsUpserted: 0 });
    expect(poolMock.connect).not.toHaveBeenCalled();
  });

  it('upserts a workout keyed on the (provider, externalId) compound constraint', async () => {
    const adapter = fakeAdapter({
      mapToWorkout: () => ({
        externalId: 'w1',
        activityType: 'running',
        startedAt: new Date('2026-01-15T17:00:00Z'),
        endedAt: new Date('2026-01-15T17:45:00Z'),
        durationMin: 45,
        calories: 380,
        distanceM: 7500,
        intensity: 'moderate',
      }),
    });

    const result = await normalizeAndUpsertWorkouts({
      userId: 'u1',
      provider: 'OURA',
      records: [{ dataType: 'WORKOUT', externalId: 'w1', dataDate: DAY_1, payload: {} }],
      adapter,
    });

    expect(result).toEqual({ workoutsUpserted: 1 });
    expect(poolMock.connect).toHaveBeenCalledTimes(1);
    const [sql, values] = clientMock.query.mock.calls[0]!;
    expect(sql).toMatch(/insert into workouts/i);
    expect(sql).toMatch(/on conflict \(provider, "externalId"\)/i);
    expect(values).toEqual([
      expect.any(String),
      'u1',
      'OURA',
      'w1',
      'running',
      new Date('2026-01-15T17:00:00Z'),
      new Date('2026-01-15T17:45:00Z'),
      45,
      380,
      7500,
      'moderate',
    ]);
  });

  it('counts only the records that actually map to a workout, on a single checked-out client', async () => {
    const adapter = fakeAdapter({
      mapToWorkout: (record) =>
        record.dataType === 'WORKOUT'
          ? {
              externalId: record.externalId,
              activityType: 'running',
              startedAt: DAY_1,
              endedAt: DAY_1,
              durationMin: 30,
            }
          : null,
    });

    const result = await normalizeAndUpsertWorkouts({
      userId: 'u1',
      provider: 'OURA',
      records: [
        { dataType: 'WORKOUT', externalId: 'w1', dataDate: DAY_1, payload: {} },
        { dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY_1, payload: {} },
      ],
      adapter,
    });

    expect(result).toEqual({ workoutsUpserted: 1 });
    expect(poolMock.connect).toHaveBeenCalledTimes(1);
    expect(clientMock.query).toHaveBeenCalledTimes(1);
    expect(clientMock.release).toHaveBeenCalledTimes(1);
  });

  it('sends null for optional workout fields the adapter did not provide', async () => {
    const adapter = fakeAdapter({
      mapToWorkout: () => ({
        externalId: 'w2',
        activityType: 'walking',
        startedAt: DAY_1,
        endedAt: DAY_1,
        durationMin: 20,
      }),
    });

    await normalizeAndUpsertWorkouts({
      userId: 'u1',
      provider: 'OURA',
      records: [{ dataType: 'WORKOUT', externalId: 'w2', dataDate: DAY_1, payload: {} }],
      adapter,
    });

    const [, values] = clientMock.query.mock.calls[0]!;
    expect(values.slice(-3)).toEqual([null, null, null]);
  });

  it('releases the client even when a query rejects partway through a multi-workout batch', async () => {
    clientMock.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    clientMock.query.mockRejectedValueOnce(new Error('boom'));
    const adapter = fakeAdapter({
      mapToWorkout: (record) => ({
        externalId: record.externalId,
        activityType: 'running',
        startedAt: DAY_1,
        endedAt: DAY_1,
        durationMin: 30,
      }),
    });

    await expect(
      normalizeAndUpsertWorkouts({
        userId: 'u1',
        provider: 'OURA',
        records: [
          { dataType: 'WORKOUT', externalId: 'w1', dataDate: DAY_1, payload: {} },
          { dataType: 'WORKOUT', externalId: 'w2', dataDate: DAY_1, payload: {} },
        ],
        adapter,
      }),
    ).rejects.toThrow('boom');

    expect(clientMock.release).toHaveBeenCalledTimes(1);
  });
});
