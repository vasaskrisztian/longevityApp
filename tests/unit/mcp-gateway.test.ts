import { describe, it, expect, vi, beforeEach } from 'vitest';

const getTodaySnapshotMock = vi.fn();
const getTrendMock = vi.fn();
vi.mock('@/modules/dashboard/dashboard.service', () => ({
  getTodaySnapshot: getTodaySnapshotMock,
  getTrend: getTrendMock,
}));

const { createHealthMcpGateway } = await import('@/mcp/gateway');

const CTX = { userId: 'user-1' };

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    date: new Date('2026-06-15T00:00:00Z'),
    isToday: true,
    sourceProviders: ['OURA'],
    sleepScore: 82,
    readinessScore: 74,
    activityScore: 65,
    totalSleepMinutes: 421,
    restingHeartRate: 54,
    averageHrv: 48.3,
    steps: 8123,
    ...overrides,
  };
}

function trendPoint(overrides: Record<string, unknown> = {}) {
  return {
    date: new Date('2026-06-14T00:00:00Z'),
    sleepScore: 80,
    readinessScore: 70,
    activityScore: 60,
    totalSleepMinutes: 400,
    restingHeartRate: 55,
    averageHrv: 47.1,
    steps: 7000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createHealthMcpGateway().getHealthSummary', () => {
  it('returns null when the user has no snapshot at all', async () => {
    getTodaySnapshotMock.mockResolvedValue(null);
    const gateway = createHealthMcpGateway();

    const result = await gateway.getHealthSummary(CTX);

    expect(result).toBeNull();
    expect(getTodaySnapshotMock).toHaveBeenCalledWith('user-1');
  });

  it('maps the dashboard snapshot to an ISO-date HealthSummary', async () => {
    getTodaySnapshotMock.mockResolvedValue(snapshot());
    const gateway = createHealthMcpGateway();

    const result = await gateway.getHealthSummary(CTX);

    expect(result).toEqual({
      date: '2026-06-15',
      isToday: true,
      sourceProviders: ['OURA'],
      sleepScore: 82,
      readinessScore: 74,
      activityScore: 65,
      totalSleepMinutes: 421,
      restingHeartRate: 54,
      averageHrv: 48.3,
      steps: 8123,
    });
  });
});

describe('createHealthMcpGateway() trend contexts', () => {
  it('getSleepContext calls getTrend with the caller\'s userId and requested range, mapping dates to ISO strings', async () => {
    getTrendMock.mockResolvedValue([trendPoint()]);
    const gateway = createHealthMcpGateway();

    const result = await gateway.getSleepContext(CTX, { rangeDays: 7 });

    expect(getTrendMock).toHaveBeenCalledWith('user-1', 7);
    expect(result).toEqual({
      rangeDays: 7,
      points: [
        {
          date: '2026-06-14',
          sleepScore: 80,
          readinessScore: 70,
          activityScore: 60,
          totalSleepMinutes: 400,
          restingHeartRate: 55,
          averageHrv: 47.1,
          steps: 7000,
        },
      ],
    });
  });

  it('getRecoveryContext calls getTrend with the requested 30-day range', async () => {
    getTrendMock.mockResolvedValue([]);
    const gateway = createHealthMcpGateway();

    const result = await gateway.getRecoveryContext(CTX, { rangeDays: 30 });

    expect(getTrendMock).toHaveBeenCalledWith('user-1', 30);
    expect(result).toEqual({ rangeDays: 30, points: [] });
  });

  it('getActivityContext calls getTrend with the requested range', async () => {
    getTrendMock.mockResolvedValue([trendPoint({ steps: 9999 })]);
    const gateway = createHealthMcpGateway();

    const result = await gateway.getActivityContext(CTX, { rangeDays: 7 });

    expect(getTrendMock).toHaveBeenCalledWith('user-1', 7);
    expect(result.points[0]?.steps).toBe(9999);
  });
});
