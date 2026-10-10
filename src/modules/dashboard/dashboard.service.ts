import { countDistinctWorkouts } from '@/modules/wearable/domain/workout-count';
import { prisma } from '@/lib/db/prisma';
import type { WearableProviderId } from '@/modules/wearable/domain/wearable-provider.types';

/**
 * Phase 6: the first code that ever READS DailyHealthMetric — every phase
 * before this only wrote to it (Phase 5's normalization.service.ts). Stays
 * strictly read-only and provider-agnostic: it has no idea Oura exists,
 * same isolation principle as the rest of modules/wearable/domain — it just
 * reads whatever `sourceProviders` normalization already recorded.
 */

export type TrendRangeDays = 7 | 30;

/** The exact field set ARCHITECTURE.md §13 calls for: "Sleep/Readiness/Activity scores, HRV, resting HR, sleep duration, steps." */
export interface DailyMetricFields {
  sleepScore: number | null;
  readinessScore: number | null;
  activityScore: number | null;
  totalSleepMinutes: number | null;
  restingHeartRate: number | null;
  averageHrv: number | null;
  steps: number | null;
  // Added alongside the Protocols feature — the only DailyHealthMetric
  // column that feature's "cél" (target) comparison needs and this
  // interface didn't already surface. See getWeeklyWorkoutCount below for
  // the other actual value protocols compare against (weekly workout
  // count, which lives on Workout, not this table).
  activeCalories: number | null;
}

export interface DailyMetricSnapshot extends DailyMetricFields {
  /** The calendar day this snapshot is for — not always "today": see getTodaySnapshot. */
  date: Date;
  /** True only when `date` is the current calendar day (UTC) — false means this is the most recent day with any data, shown as a fallback. */
  isToday: boolean;
  sourceProviders: WearableProviderId[];
}

export interface TrendPoint extends DailyMetricFields {
  date: Date;
}

/** `TrendPoint` with `date` serialized to a plain `yyyy-mm-dd` string, the
 * shape the trends UI (trend-charts.tsx's TrendPointDTO) expects over the
 * wire. Both the server-rendered trends page and the client-side
 * /api/dashboard/trends route (used when switching the 7/30-day toggle)
 * must produce this same shape -- the route used to hand back raw `Date`
 * objects, which `Response.json` serializes to a full ISO *datetime*
 * string (e.g. "2026-09-23T00:00:00.000Z"). trend-charts.tsx's
 * formatDateLabel appended its own "T00:00:00Z" suffix assuming a
 * date-only string, so a full datetime string became a malformed
 * double-suffixed one and silently parsed as Invalid Date on every chart
 * x-axis after a range switch. */
export interface TrendPointDTO extends DailyMetricFields {
  date: string;
}

export function toTrendPointDTO(point: TrendPoint): TrendPointDTO {
  return { ...point, date: point.date.toISOString().slice(0, 10) };
}

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * `averageHrv` is a Prisma `Decimal` column — the generated client returns a
 * Decimal.js instance, not a plain number, so every read site must convert
 * explicitly (ARCHITECTURE.md's schema comment; the same conversion Phase
 * 5's normalization writes never needed, since it only ever wrote numbers
 * in, never read Decimals back out). The other six fields here are plain
 * Int columns and pass through unchanged.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDailyMetricFields(row: any): DailyMetricFields {
  return {
    sleepScore: row.sleepScore ?? null,
    readinessScore: row.readinessScore ?? null,
    activityScore: row.activityScore ?? null,
    totalSleepMinutes: row.totalSleepMinutes ?? null,
    restingHeartRate: row.restingHeartRate ?? null,
    averageHrv: row.averageHrv === null || row.averageHrv === undefined ? null : Number(row.averageHrv),
    steps: row.steps ?? null,
    activeCalories: row.activeCalories ?? null,
  };
}

const EMPTY_FIELDS: DailyMetricFields = {
  sleepScore: null,
  readinessScore: null,
  activityScore: null,
  totalSleepMinutes: null,
  restingHeartRate: null,
  averageHrv: null,
  steps: null,
  activeCalories: null,
};

/**
 * The dashboard's "today" card. Daily sync (Phase 7) hasn't run yet as of
 * this phase, and even once it has, a given day's sync may not have landed
 * before the user opens the dashboard — so this deliberately falls back to
 * the most recent available day (`isToday: false`) rather than showing a
 * hard "no data for today" wall. Returns null only when the user has NO
 * DailyHealthMetric rows at all (never connected, or connected but nothing
 * has synced yet).
 */
export async function getTodaySnapshot(userId: string): Promise<DailyMetricSnapshot | null> {
  const today = utcMidnight(new Date());
  const row = await prisma.dailyHealthMetric.findFirst({
    where: { userId, date: { lte: today } },
    orderBy: { date: 'desc' },
  });
  if (!row) {
    return null;
  }
  return {
    date: row.date,
    isToday: toDateKey(row.date) === toDateKey(today),
    sourceProviders: row.sourceProviders ?? [],
    ...toDailyMetricFields(row),
  };
}

/**
 * One point per calendar day in the window, oldest first — including days
 * with no DailyHealthMetric row (all-null fields), so a chart's x-axis is
 * always a complete, gap-free date range regardless of how much history
 * has actually synced. `rangeDays` is 7 or 30 per ARCHITECTURE.md §13;
 * the window is [today - (rangeDays-1), today] inclusive, so `rangeDays`
 * itself is exactly how many points come back.
 */
export async function getTrend(userId: string, rangeDays: TrendRangeDays): Promise<TrendPoint[]> {
  const today = utcMidnight(new Date());
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - (rangeDays - 1));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await prisma.dailyHealthMetric.findMany({
    where: { userId, date: { gte: from, lte: today } },
    orderBy: { date: 'asc' },
  });
  const rowsByDateKey = new Map(rows.map((row) => [toDateKey(row.date), row]));

  const points: TrendPoint[] = [];
  const cursor = new Date(from);
  while (cursor.getTime() <= today.getTime()) {
    const key = toDateKey(cursor);
    const row = rowsByDateKey.get(key);
    points.push({
      date: new Date(cursor),
      ...(row ? toDailyMetricFields(row) : EMPTY_FIELDS),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

/**
 * How many distinct workouts (see workout-count.ts for what counts) landed in the trailing 7-day window [today - 6, today]
 * (inclusive) — the "actual" the Protocols feature's targetWeeklyWorkouts
 * compares against on the dashboard. Lives here rather than in
 * modules/protocols since it reads Workout, a wearable-sync table this
 * module already owns reading from.
 */
export async function getWeeklyWorkoutCount(userId: string): Promise<number> {
  const today = utcMidnight(new Date());
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 6);
  const to = new Date(today);
  to.setUTCDate(to.getUTCDate() + 1);

  const workouts = await prisma.workout.findMany({
    where: { userId, startedAt: { gte: from, lt: to } },
    select: { startedAt: true, endedAt: true, durationMin: true, activityType: true, source: true },
  });
  return countDistinctWorkouts(workouts);
}
