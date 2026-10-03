import { apiFetchJson } from '@/src/api/client';
import { toProtocol, type Protocol, type RawProtocol } from '@/src/api/protocols';

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

export interface ProtocolOverlay {
  /** The user's own active protocol (at most one) — not a creator's public
   * protocol someone follows; see protocols.service.ts's getActiveProtocol
   * doc comment. Null means the user isn't following a protocol, and every
   * target-line/"Following: X" bit of the dashboard overlay simply doesn't
   * render, same as the web dashboard. */
  activeProtocol: Protocol | null;
  /** Workouts in the trailing 7-day window (today-6..today inclusive) —
   * the "actual" compared against activeProtocol.targetWeeklyWorkouts. */
  weeklyWorkoutCount: number;
}

interface RawProtocolOverlay {
  activeProtocol: RawProtocol | null;
  weeklyWorkoutCount: number;
}

/** GET /api/dashboard/protocol-overlay — new in phase 22's follow-up; see
 * that route's doc comment for why this is a separate route rather than a
 * reshape of GET /api/dashboard's existing `DashboardSnapshot | null`
 * contract. */
export async function getProtocolOverlay(): Promise<ProtocolOverlay> {
  const raw = await apiFetchJson<RawProtocolOverlay>('/api/dashboard/protocol-overlay');
  return {
    activeProtocol: raw.activeProtocol ? toProtocol(raw.activeProtocol) : null,
    weeklyWorkoutCount: raw.weeklyWorkoutCount,
  };
}
