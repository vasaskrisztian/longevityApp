import { apiFetchJson } from '@/src/api/client';

/**
 * Mirrors modules/dashboard/dashboard.service.ts's DailyMetricFields exactly
 * — the wire shape the existing /api/dashboard and /api/dashboard/trends
 * routes already produce (phase 17 added no new backend routes, only mobile
 * screens consuming the ones phase 16's requireAuthenticatedUser() Bearer
 * fallback already made reachable from a native client).
 */
export interface DailyMetricFields {
  sleepScore: number | null;
  readinessScore: number | null;
  activityScore: number | null;
  totalSleepMinutes: number | null;
  restingHeartRate: number | null;
  averageHrv: number | null;
  steps: number | null;
  activeCalories: number | null;
}

export interface DashboardSnapshot extends DailyMetricFields {
  /** ISO datetime string — Response.json serializes the service's `Date` this way. */
  date: string;
  isToday: boolean;
  sourceProviders: string[];
}

export interface TrendPoint extends DailyMetricFields {
  /** Plain yyyy-mm-dd, per toTrendPointDTO on the server. */
  date: string;
}

export type TrendRangeDays = 7 | 30;

/** GET /api/dashboard — null means the user has no DailyHealthMetric rows at all yet. */
export function getDashboardSnapshot(): Promise<DashboardSnapshot | null> {
  return apiFetchJson<DashboardSnapshot | null>('/api/dashboard');
}

/** GET /api/dashboard/trends?range=7|30 */
export function getTrends(range: TrendRangeDays): Promise<TrendPoint[]> {
  return apiFetchJson<TrendPoint[]>(`/api/dashboard/trends?range=${range}`);
}
