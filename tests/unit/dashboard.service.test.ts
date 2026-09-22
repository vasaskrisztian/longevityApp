import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  dailyHealthMetric: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const { getTodaySnapshot, getTrend } = await import('@/modules/dashboard/dashboard.service');

/** Freezes "now" so isToday/date-window assertions aren't flaky across midnight. */
const TODAY = new Date('2026-06-15T12:00:00Z');

function row(overrides: Record<string, unknown> = {}) {
  return {
    date: new Date('2026-06-15T00:00:00Z'),
    sleepScore: 82,
    readinessScore: 74,
    activityScore: 65,
    totalSleepMinutes: 421,
    restingHeartRate: 54,
    averageHrv: { toString: () => '48.30' } as unknown as number, // Decimal-like stub
    steps: 8123,
    sourceProviders: ['OURA'],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

describe('getTodaySnapshot', () => {
  it('returns null when the user has no DailyHealthMetric rows at all', async () => {
    prismaMock.dailyHealthMetric.findFirst.mockResolvedValue(null);

    const result = await getTodaySnapshot('u1');

    expect(result).toBeNull();
  });

  it('queries scoped to userId, most recent day at or before today', async () => {
    prismaMock.dailyHealthMetric.findFirst.mockResolvedValue(null);

    await getTodaySnapshot('u1');

    expect(prismaMock.dailyHealthMetric.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u1', date: { lte: new Date('2026-06-15T00:00:00Z') } },
      orderBy: { date: 'desc' },
    });
  });

  it('marks isToday true when the most recent row is for the current UTC day', async () => {
    prismaMock.dailyHealthMetric.findFirst.mockResolvedValue(row());

    const result = await getTodaySnapshot('u1');

    expect(result?.isToday).toBe(true);
  });

  it('marks isToday false when the most recent row is a stale fallback from an earlier day', async () => {
    prismaMock.dailyHealthMetric.findFirst.mockResolvedValue(
      row({ date: new Date('2026-06-12T00:00:00Z') }),
    );

    const result = await getTodaySnapshot('u1');

    expect(result?.isToday).toBe(false);
    expect(result?.date).toEqual(new Date('2026-06-12T00:00:00Z'));
  });

  it('converts the averageHrv Decimal to a plain number', async () => {
    prismaMock.dailyHealthMetric.findFirst.mockResolvedValue(row());

    const result = await getTodaySnapshot('u1');

    expect(result?.averageHrv).toBe(48.3);
    expect(typeof result?.averageHrv).toBe('number');
  });

  it('maps null averageHrv straight through as null, never Number(null)=0', async () => {
    prismaMock.dailyHealthMetric.findFirst.mockResolvedValue(row({ averageHrv: null }));

    const result = await getTodaySnapshot('u1');

    expect(result?.averageHrv).toBeNull();
  });

  it('falls back every plain Int field to null when the row has it as null/undefined', async () => {
    prismaMock.dailyHealthMetric.findFirst.mockResolvedValue(
      row({
        sleepScore: null,
        readinessScore: undefined,
        activityScore: null,
        totalSleepMinutes: undefined,
        restingHeartRate: null,
        steps: undefined,
      }),
    );

    const result = await getTodaySnapshot('u1');

    expect(result).toMatchObject({
      sleepScore: null,
      readinessScore: null,
      activityScore: null,
      totalSleepMinutes: null,
      restingHeartRate: null,
      steps: null,
    });
  });

  it('defaults sourceProviders to an empty array when the row has none set', async () => {
    prismaMock.dailyHealthMetric.findFirst.mockResolvedValue(row({ sourceProviders: null }));

    const result = await getTodaySnapshot('u1');

    expect(result?.sourceProviders).toEqual([]);
  });

  it('passes every other field through unchanged', async () => {
    prismaMock.dailyHealthMetric.findFirst.mockResolvedValue(row());

    const result = await getTodaySnapshot('u1');

    expect(result).toMatchObject({
      sleepScore: 82,
      readinessScore: 74,
      activityScore: 65,
      totalSleepMinutes: 421,
      restingHeartRate: 54,
      steps: 8123,
    });
  });
});

describe('getTrend', () => {
  it('queries the exact inclusive [today - (rangeDays-1), today] window for a 7-day range', async () => {
    prismaMock.dailyHealthMetric.findMany.mockResolvedValue([]);

    await getTrend('u1', 7);

    expect(prismaMock.dailyHealthMetric.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        date: { gte: new Date('2026-06-09T00:00:00Z'), lte: new Date('2026-06-15T00:00:00Z') },
      },
      orderBy: { date: 'asc' },
    });
  });

  it('queries a 30-day window when rangeDays is 30', async () => {
    prismaMock.dailyHealthMetric.findMany.mockResolvedValue([]);

    await getTrend('u1', 30);

    expect(prismaMock.dailyHealthMetric.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        date: { gte: new Date('2026-05-17T00:00:00Z'), lte: new Date('2026-06-15T00:00:00Z') },
      },
      orderBy: { date: 'asc' },
    });
  });

  it('returns exactly rangeDays points, oldest first, even with zero underlying rows', async () => {
    prismaMock.dailyHealthMetric.findMany.mockResolvedValue([]);

    const result = await getTrend('u1', 7);

    expect(result).toHaveLength(7);
    expect(result[0]?.date).toEqual(new Date('2026-06-09T00:00:00Z'));
    expect(result[6]?.date).toEqual(new Date('2026-06-15T00:00:00Z'));
  });

  it('fills days with no row with all-null fields rather than skipping them', async () => {
    prismaMock.dailyHealthMetric.findMany.mockResolvedValue([row()]);

    const result = await getTrend('u1', 7);

    const gapDay = result.find((p) => p.date.getTime() === new Date('2026-06-10T00:00:00Z').getTime());
    expect(gapDay).toMatchObject({
      sleepScore: null,
      readinessScore: null,
      activityScore: null,
      totalSleepMinutes: null,
      restingHeartRate: null,
      averageHrv: null,
      steps: null,
    });
  });

  it('places a returned row on its own date with converted fields, leaving other days untouched', async () => {
    prismaMock.dailyHealthMetric.findMany.mockResolvedValue([row()]);

    const result = await getTrend('u1', 7);

    const todayPoint = result.find((p) => p.date.getTime() === new Date('2026-06-15T00:00:00Z').getTime());
    expect(todayPoint).toMatchObject({ sleepScore: 82, averageHrv: 48.3 });
  });

  it('places multiple rows on their correct distinct dates', async () => {
    prismaMock.dailyHealthMetric.findMany.mockResolvedValue([
      row({ date: new Date('2026-06-09T00:00:00Z'), sleepScore: 10 }),
      row({ date: new Date('2026-06-15T00:00:00Z'), sleepScore: 20 }),
    ]);

    const result = await getTrend('u1', 7);

    expect(result[0]).toMatchObject({ sleepScore: 10 });
    expect(result[6]).toMatchObject({ sleepScore: 20 });
    expect(result.slice(1, 6).every((p) => p.sleepScore === null)).toBe(true);
  });
});
