import { prisma } from '@/lib/db/prisma';
import { recordAuditLog } from '@/lib/audit/audit-log.service';
import { listConnectionsForUser } from '@/modules/wearable/services/wearable.service';
import {
  getTodaySnapshot,
  getTrend,
  getWeeklyWorkoutCount,
  toTrendPointDTO,
  type DailyMetricFields,
  type TrendPointDTO,
} from '@/modules/dashboard/dashboard.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MemberHealthDTO {
  member: { userId: string; email: string; fullName: string | null; joinedAt: string };
  connections: {
    provider: string;
    status: string;
    lastSyncAt: string | null;
  }[];
  /** The most recent day with data (today, or a stale fallback — see `isToday`). */
  snapshot: (DailyMetricFields & { date: string; isToday: boolean; sourceProviders: string[] }) | null;
  trend: TrendPointDTO[];
  /** Distinct workouts in the last 7 days under the dashboard's counting rule. */
  weeklyWorkouts: number;
  /** The raw workouts of the last 14 days, so a surprising count can be checked against its source. */
  recentWorkouts: {
    startedAt: string;
    durationMin: number;
    activityType: string;
    provider: string;
    source: string | null;
  }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * An administrator's view of one group member's health data. Allowed only
 * for people who are members of that very group (i.e. accepted the
 * invitation and consented to this) — a user id that is not a member of the
 * group returns null, which the route turns into a 404. Every successful
 * read writes the same `ADMIN_VIEW_USER` audit row as the existing admin
 * user dashboard.
 */
export async function getMemberHealthForAdmin(
  adminId: string,
  groupId: string,
  userId: string,
): Promise<MemberHealthDTO | null> {
  const membership: any = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: {
      createdAt: true,
      user: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
    },
  });
  if (!membership) return null;

  const since = new Date(Date.now() - 14 * DAY_MS);
  const [connections, snapshot, trend, weeklyWorkouts, workouts] = await Promise.all([
    listConnectionsForUser(userId),
    getTodaySnapshot(userId),
    getTrend(userId, 30),
    getWeeklyWorkoutCount(userId),
    prisma.workout.findMany({
      where: { userId, startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' },
      take: 100,
      select: { startedAt: true, durationMin: true, activityType: true, provider: true, source: true },
    }),
  ]);

  await recordAuditLog({
    actorUserId: adminId,
    targetUserId: userId,
    action: 'ADMIN_VIEW_USER',
    entityType: 'WellbeingGroup',
    entityId: groupId,
  });

  return {
    member: {
      userId: membership.user.id,
      email: membership.user.email,
      fullName: membership.user.profile?.fullName ?? null,
      joinedAt: membership.createdAt.toISOString(),
    },
    connections: connections
      .filter((connection) => connection.status !== 'DISCONNECTED' || connection.lastSyncAt)
      .map((connection) => ({
        provider: connection.provider,
        status: connection.status,
        lastSyncAt: connection.lastSyncAt ? connection.lastSyncAt.toISOString() : null,
      })),
    snapshot: snapshot
      ? {
          ...snapshot,
          date: snapshot.date.toISOString().slice(0, 10),
          sourceProviders: snapshot.sourceProviders as string[],
        }
      : null,
    trend: trend.map(toTrendPointDTO),
    weeklyWorkouts,
    recentWorkouts: (workouts as any[]).map((workout) => ({
      startedAt: workout.startedAt.toISOString(),
      durationMin: workout.durationMin,
      activityType: workout.activityType,
      provider: workout.provider,
      source: workout.source ?? null,
    })),
  };
}
