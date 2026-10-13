import { getActiveProtocol } from '@/modules/protocols/protocols.service';
import {
  BASELINE_DAYS,
  RECENT_DAYS,
  computeInsights,
  type InsightsResult,
} from '@/modules/dashboard/insights';
import { getDailyWindow, getWeeklyWorkoutCount, type TrendPoint } from '@/modules/dashboard/dashboard.service';

/**
 * Gathers what the pure rules in insights.ts need — the last 33 days of daily
 * metrics (30 baseline + 3 recent), the user's own active protocol targets and
 * the trailing weekly workout count — always for the caller's own id.
 */
export async function getInsights(userId: string): Promise<InsightsResult> {
  const [points, protocol, weeklyWorkoutCount] = await Promise.all([
    getDailyWindow(userId, BASELINE_DAYS + RECENT_DAYS),
    getActiveProtocol(userId),
    getWeeklyWorkoutCount(userId),
  ]);

  return computeInsights({
    points: points.map((p: TrendPoint) => ({
      date: p.date.toISOString().slice(0, 10),
      sleepScore: p.sleepScore,
      totalSleepMinutes: p.totalSleepMinutes,
      restingHeartRate: p.restingHeartRate,
      averageHrv: p.averageHrv,
    })),
    targets: {
      sleepScore: protocol?.targetSleepScore ?? null,
      sleepMinutes: protocol?.targetSleepMinutes ?? null,
      weeklyWorkouts: protocol?.targetWeeklyWorkouts ?? null,
    },
    weeklyWorkoutCount,
    today: new Date().toISOString().slice(0, 10),
  });
}
