import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WearableProviderAdapter } from '@/modules/wearable/domain/wearable-provider.types';

const prismaMock = {
  dailyHealthMetric: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  workout: {
    upsert: vi.fn(),
  },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

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
    expect(prismaMock.dailyHealthMetric.upsert).not.toHaveBeenCalled();
  });

  it('merges two records mapping to the same date into one upsert', async () => {
    prismaMock.dailyHealthMetric.findUnique.mockResolvedValue(null);
    prismaMock.dailyHealthMetric.upsert.mockResolvedValue({});
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
    expect(prismaMock.dailyHealthMetric.upsert).toHaveBeenCalledTimes(1);
    const call = prismaMock.dailyHealthMetric.upsert.mock.calls[0]![0];
    expect(call.create).toMatchObject({ userId: 'u1', date: DAY_1, sleepScore: 80, steps: 5000 });
  });

  it('upserts one row per distinct date when records span multiple days', async () => {
    prismaMock.dailyHealthMetric.findUnique.mockResolvedValue(null);
    prismaMock.dailyHealthMetric.upsert.mockResolvedValue({});
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
    expect(prismaMock.dailyHealthMetric.upsert).toHaveBeenCalledTimes(2);
  });

  it('adds the provider to sourceProviders without dropping providers already recorded for that date', async () => {
    prismaMock.dailyHealthMetric.findUnique.mockResolvedValue({ sourceProviders: ['GARMIN'] });
    prismaMock.dailyHealthMetric.upsert.mockResolvedValue({});
    const adapter = fakeAdapter({
      mapToNormalizedFields: () => ({ date: DAY_1, fields: { sleepScore: 80 } }),
    });

    await normalizeAndUpsertDailyMetrics({
      userId: 'u1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY_1, payload: {} }],
      adapter,
    });

    const call = prismaMock.dailyHealthMetric.upsert.mock.calls[0]![0];
    expect(call.create.sourceProviders.sort()).toEqual(['GARMIN', 'OURA']);
  });

  it('does not duplicate the provider in sourceProviders when it is already present', async () => {
    prismaMock.dailyHealthMetric.findUnique.mockResolvedValue({ sourceProviders: ['OURA'] });
    prismaMock.dailyHealthMetric.upsert.mockResolvedValue({});
    const adapter = fakeAdapter({
      mapToNormalizedFields: () => ({ date: DAY_1, fields: { sleepScore: 80 } }),
    });

    await normalizeAndUpsertDailyMetrics({
      userId: 'u1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY_1, payload: {} }],
      adapter,
    });

    const call = prismaMock.dailyHealthMetric.upsert.mock.calls[0]![0];
    expect(call.create.sourceProviders).toEqual(['OURA']);
  });

  it('upserts keyed on the (userId, date) compound constraint', async () => {
    prismaMock.dailyHealthMetric.findUnique.mockResolvedValue(null);
    prismaMock.dailyHealthMetric.upsert.mockResolvedValue({});
    const adapter = fakeAdapter({
      mapToNormalizedFields: () => ({ date: DAY_1, fields: { sleepScore: 80 } }),
    });

    await normalizeAndUpsertDailyMetrics({
      userId: 'u1',
      provider: 'OURA',
      records: [{ dataType: 'DAILY_SLEEP', externalId: 's1', dataDate: DAY_1, payload: {} }],
      adapter,
    });

    expect(prismaMock.dailyHealthMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_date: { userId: 'u1', date: DAY_1 } } }),
    );
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
    expect(prismaMock.workout.upsert).not.toHaveBeenCalled();
  });

  it('upserts a workout keyed on the (provider, externalId) compound constraint', async () => {
    prismaMock.workout.upsert.mockResolvedValue({});
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
    expect(prismaMock.workout.upsert).toHaveBeenCalledWith({
      where: { provider_externalId: { provider: 'OURA', externalId: 'w1' } },
      create: expect.objectContaining({ userId: 'u1', provider: 'OURA', externalId: 'w1', activityType: 'running' }),
      update: expect.objectContaining({ activityType: 'running' }),
    });
  });

  it('counts only the records that actually map to a workout', async () => {
    prismaMock.workout.upsert.mockResolvedValue({});
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
  });
});
