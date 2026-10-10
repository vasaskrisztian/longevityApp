import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  groupMembership: { findUnique: vi.fn() },
  workout: { findMany: vi.fn() },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
const recordAuditLog = vi.fn();
vi.mock('@/lib/audit/audit-log.service', () => ({ recordAuditLog }));
const listConnectionsForUser = vi.fn();
vi.mock('@/modules/wearable/services/wearable.service', () => ({ listConnectionsForUser }));
const getTodaySnapshot = vi.fn();
const getTrend = vi.fn();
const getWeeklyWorkoutCount = vi.fn();
vi.mock('@/modules/dashboard/dashboard.service', () => ({
  getTodaySnapshot,
  getTrend,
  getWeeklyWorkoutCount,
  toTrendPointDTO: (p: { date: Date }) => ({ ...p, date: p.date.toISOString().slice(0, 10) }),
}));

const { getMemberHealthForAdmin } = await import('@/modules/groups/member-health.service');

const JOINED = new Date('2026-10-01T00:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  listConnectionsForUser.mockResolvedValue([]);
  getTodaySnapshot.mockResolvedValue(null);
  getTrend.mockResolvedValue([]);
  getWeeklyWorkoutCount.mockResolvedValue(0);
  prismaMock.workout.findMany.mockResolvedValue([]);
});

describe('getMemberHealthForAdmin', () => {
  it('returns null — and reads and audits nothing — for a user who is not a member of that group', async () => {
    prismaMock.groupMembership.findUnique.mockResolvedValue(null);

    expect(await getMemberHealthForAdmin('admin', 'g1', 'stranger')).toBeNull();

    expect(prismaMock.groupMembership.findUnique.mock.calls[0]![0].where).toEqual({
      groupId_userId: { groupId: 'g1', userId: 'stranger' },
    });
    expect(getTodaySnapshot).not.toHaveBeenCalled();
    expect(prismaMock.workout.findMany).not.toHaveBeenCalled();
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it('assembles snapshot, trend, workouts and devices, and writes the ADMIN_VIEW_USER audit row', async () => {
    prismaMock.groupMembership.findUnique.mockResolvedValue({
      createdAt: JOINED,
      user: { id: 'u1', email: 'a@x.com', profile: { fullName: 'Anna' } },
    });
    listConnectionsForUser.mockResolvedValue([
      { provider: 'OURA', status: 'CONNECTED', lastSyncAt: new Date('2026-10-10T07:00:00Z') },
      { provider: 'APPLE_HEALTH', status: 'DISCONNECTED', lastSyncAt: null },
    ]);
    getTodaySnapshot.mockResolvedValue({
      date: new Date('2026-10-10T00:00:00Z'),
      isToday: true,
      sourceProviders: ['OURA'],
      sleepScore: 82,
      readinessScore: null,
      activityScore: null,
      totalSleepMinutes: 420,
      restingHeartRate: 55,
      averageHrv: 48,
      steps: 9000,
      activeCalories: 400,
    });
    getTrend.mockResolvedValue([{ date: new Date('2026-10-10T00:00:00Z'), sleepScore: 82 }]);
    getWeeklyWorkoutCount.mockResolvedValue(3);
    prismaMock.workout.findMany.mockResolvedValue([
      { startedAt: new Date('2026-10-09T06:00:00Z'), durationMin: 45, activityType: 'running', provider: 'OURA', source: 'confirmed' },
    ]);

    const health = await getMemberHealthForAdmin('admin', 'g1', 'u1');

    expect(health!.member).toEqual({ userId: 'u1', email: 'a@x.com', fullName: 'Anna', joinedAt: JOINED.toISOString() });
    expect(health!.snapshot).toMatchObject({ date: '2026-10-10', isToday: true, sleepScore: 82, steps: 9000, sourceProviders: ['OURA'] });
    expect(health!.trend).toEqual([{ date: '2026-10-10', sleepScore: 82 }]);
    expect(health!.weeklyWorkouts).toBe(3);
    // A never-connected, never-synced provider is not listed.
    expect(health!.connections).toEqual([{ provider: 'OURA', status: 'CONNECTED', lastSyncAt: '2026-10-10T07:00:00.000Z' }]);
    expect(health!.recentWorkouts).toEqual([
      { startedAt: '2026-10-09T06:00:00.000Z', durationMin: 45, activityType: 'running', provider: 'OURA', source: 'confirmed' },
    ]);
    expect(prismaMock.workout.findMany.mock.calls[0]![0].where.userId).toBe('u1');
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'admin', targetUserId: 'u1', action: 'ADMIN_VIEW_USER', entityId: 'g1' }),
    );
  });

  it('handles a member with no data at all (null snapshot, empty lists)', async () => {
    prismaMock.groupMembership.findUnique.mockResolvedValue({
      createdAt: JOINED,
      user: { id: 'u2', email: 'b@x.com', profile: null },
    });
    const health = await getMemberHealthForAdmin('admin', 'g1', 'u2');
    expect(health).toMatchObject({ snapshot: null, trend: [], recentWorkouts: [], weeklyWorkouts: 0, member: { fullName: null } });
  });
});
