/**
 * Personal baseline + daily summary ("insights") for the Today screen.
 *
 * Pure and rules-based on purpose: no AI, no database, no clock of its own
 * (the caller passes `today`), so every sentence the user sees can be traced
 * to a number and tested. Wording stays on the wellness side of the line —
 * it describes how recent days compare with the person's own usual values and
 * their protocol targets, and never diagnoses anything.
 *
 * Windows: "recent" = the last 3 calendar days (today included), "baseline" =
 * the 30 days before that. A metric needs at least MIN_RECENT_VALUES recent
 * values and MIN_BASELINE_VALUES baseline values before it is compared.
 */

export type InsightSeverity = 'good' | 'info' | 'attention';

export interface InsightMetricPoint {
  /** Plain yyyy-mm-dd (UTC day). */
  date: string;
  sleepScore: number | null;
  totalSleepMinutes: number | null;
  restingHeartRate: number | null;
  averageHrv: number | null;
}

export interface InsightTargets {
  sleepScore: number | null;
  sleepMinutes: number | null;
  weeklyWorkouts: number | null;
}

export interface InsightInput {
  /** Daily points, any order; days without data may be missing or all-null. */
  points: InsightMetricPoint[];
  targets: InsightTargets;
  weeklyWorkoutCount: number | null;
  /** Current UTC day, yyyy-mm-dd. */
  today: string;
}

export interface Insight {
  key: string;
  severity: InsightSeverity;
  title: string;
  message: string;
}

export interface InsightsResult {
  headline: string;
  items: Insight[];
  /** Most recent day that had any of the four metrics, yyyy-mm-dd; null when there is none. */
  latestDataDate: string | null;
  /** Days of baseline data found (capped display value is up to the UI); the comparison needs MIN_BASELINE_VALUES. */
  baselineDays: number;
  hasEnoughHistory: boolean;
}

export const RECENT_DAYS = 3;
export const BASELINE_DAYS = 30;
export const MIN_RECENT_VALUES = 2;
export const MIN_BASELINE_VALUES = 7;
const STALE_AFTER_DAYS = 2;
const RHR_STEP_BPM = 3;
const SLEEP_SCORE_MARGIN = 8;
const SLEEP_SHORTFALL_MINUTES = 30;
const SLEEP_BASELINE_SHORTFALL_MINUTES = 45;

type MetricKey = 'sleepScore' | 'totalSleepMinutes' | 'restingHeartRate' | 'averageHrv';

function dayNumber(dateKey: string): number {
  return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86_400_000);
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** "7h 30m" / "8h" / "45m" — same shape the app uses elsewhere for sleep time. */
export function formatMinutes(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface Compared {
  recent: number;
  baseline: number | null;
  baselineSd: number;
  recentCount: number;
}

function compare(points: InsightMetricPoint[], key: MetricKey, todayNumber: number): Compared | null {
  const recent: number[] = [];
  const baseline: number[] = [];
  for (const point of points) {
    const value = point[key];
    if (value === null || value === undefined || Number.isNaN(value)) continue;
    const age = todayNumber - dayNumber(point.date);
    if (age < 0) continue;
    if (age < RECENT_DAYS) recent.push(value);
    else if (age < RECENT_DAYS + BASELINE_DAYS) baseline.push(value);
  }
  if (recent.length < MIN_RECENT_VALUES) return null;
  const hasBaseline = baseline.length >= MIN_BASELINE_VALUES;
  return {
    recent: mean(recent),
    baseline: hasBaseline ? mean(baseline) : null,
    baselineSd: hasBaseline ? standardDeviation(baseline) : 0,
    recentCount: recent.length,
  };
}

function hrvInsight(c: Compared | null): Insight | null {
  if (!c || c.baseline === null) return null;
  // Floor on the spread so a very steady baseline does not flag tiny moves.
  const spread = Math.max(c.baselineSd, c.baseline * 0.08);
  const z = (c.recent - c.baseline) / spread;
  const percent = Math.abs(round(((c.recent - c.baseline) / c.baseline) * 100));
  const detail = `${round(c.recent)} ms over the last ${RECENT_DAYS} days vs your usual ${round(c.baseline)} ms`;
  if (z <= -1) {
    return {
      key: 'hrv',
      severity: 'attention',
      title: 'HRV is below your usual',
      message: `${detail} (${percent}% lower). A lighter day and an early night often help it recover.`,
    };
  }
  if (z >= 1) {
    return {
      key: 'hrv',
      severity: 'good',
      title: 'HRV is above your usual',
      message: `${detail} (${percent}% higher) — a good sign that you are recovering well.`,
    };
  }
  return null;
}

function restingHrInsight(c: Compared | null): Insight | null {
  if (!c || c.baseline === null) return null;
  const delta = c.recent - c.baseline;
  const detail = `${round(c.recent)} bpm over the last ${RECENT_DAYS} days vs your usual ${round(c.baseline)} bpm`;
  if (delta >= RHR_STEP_BPM) {
    return {
      key: 'resting-hr',
      severity: 'attention',
      title: 'Resting heart rate is higher than usual',
      message: `${detail} (+${round(delta)} bpm). Stress, a late meal, alcohol or too little rest can all push it up.`,
    };
  }
  if (delta <= -RHR_STEP_BPM) {
    return {
      key: 'resting-hr',
      severity: 'good',
      title: 'Resting heart rate is lower than usual',
      message: `${detail} (${round(delta)} bpm) — usually a sign of good recovery.`,
    };
  }
  return null;
}

function sleepDurationInsight(c: Compared | null, targetMinutes: number | null): Insight | null {
  if (!c) return null;
  const avg = formatMinutes(c.recent);
  if (targetMinutes !== null) {
    const diff = c.recent - targetMinutes;
    if (diff <= -SLEEP_SHORTFALL_MINUTES) {
      return {
        key: 'sleep-duration',
        severity: 'attention',
        title: 'Sleeping less than your target',
        message: `You averaged ${avg} over the last ${RECENT_DAYS} days — ${formatMinutes(-diff)} under your ${formatMinutes(targetMinutes)} target.`,
      };
    }
    if (diff >= -15) {
      return {
        key: 'sleep-duration',
        severity: 'good',
        title: 'Sleep duration on target',
        message: `You averaged ${avg} over the last ${RECENT_DAYS} days against a ${formatMinutes(targetMinutes)} target.`,
      };
    }
    return null;
  }
  if (c.baseline !== null && c.recent - c.baseline <= -SLEEP_BASELINE_SHORTFALL_MINUTES) {
    return {
      key: 'sleep-duration',
      severity: 'attention',
      title: 'Sleeping less than usual',
      message: `You averaged ${avg} over the last ${RECENT_DAYS} days vs your usual ${formatMinutes(c.baseline)}.`,
    };
  }
  return null;
}

function sleepScoreInsight(c: Compared | null, target: number | null): Insight | null {
  if (!c) return null;
  const avg = round(c.recent);
  if (target !== null) {
    const diff = c.recent - target;
    if (diff >= 0) {
      return {
        key: 'sleep-score',
        severity: 'good',
        title: 'Sleep score at or above target',
        message: `Your sleep score averaged ${avg} over the last ${RECENT_DAYS} days (target ${target}).`,
      };
    }
    if (diff <= -SLEEP_SCORE_MARGIN) {
      return {
        key: 'sleep-score',
        severity: 'attention',
        title: 'Sleep score below target',
        message: `Your sleep score averaged ${avg} over the last ${RECENT_DAYS} days (target ${target}).`,
      };
    }
    return null;
  }
  if (c.baseline !== null && c.recent - c.baseline <= -SLEEP_SCORE_MARGIN) {
    return {
      key: 'sleep-score',
      severity: 'attention',
      title: 'Sleep score dipped',
      message: `Your sleep score averaged ${avg} over the last ${RECENT_DAYS} days vs your usual ${round(c.baseline)}.`,
    };
  }
  return null;
}

function workoutInsight(count: number | null, target: number | null): Insight | null {
  if (count === null || target === null || target <= 0) return null;
  if (count >= target) {
    return {
      key: 'workouts',
      severity: 'good',
      title: 'Weekly workout goal reached',
      message: `${count} workout${count === 1 ? '' : 's'} in the last 7 days (target ${target}).`,
    };
  }
  return {
    key: 'workouts',
    severity: 'info',
    title: 'Workouts this week',
    message: `${count} of ${target} workouts in the last 7 days — ${target - count} to go.`,
  };
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = { attention: 0, good: 1, info: 2 };

export function computeInsights(input: InsightInput): InsightsResult {
  const { points, targets, weeklyWorkoutCount, today } = input;
  const todayNumber = dayNumber(today);
  const items: Insight[] = [];

  const hasAny = (p: InsightMetricPoint) =>
    p.sleepScore !== null || p.totalSleepMinutes !== null || p.restingHeartRate !== null || p.averageHrv !== null;
  const dated = points.filter((p) => hasAny(p) && dayNumber(p.date) <= todayNumber);
  const latestDataDate = dated.length > 0 ? dated.map((p) => p.date).sort().at(-1)! : null;
  const baselineDays = dated.filter((p) => {
    const age = todayNumber - dayNumber(p.date);
    return age >= RECENT_DAYS && age < RECENT_DAYS + BASELINE_DAYS;
  }).length;
  const hasEnoughHistory = baselineDays >= MIN_BASELINE_VALUES;

  const hrv = hrvInsight(compare(points, 'averageHrv', todayNumber));
  const rhr = restingHrInsight(compare(points, 'restingHeartRate', todayNumber));
  if (hrv?.severity === 'attention' && rhr?.severity === 'attention') {
    items.push({
      key: 'recovery',
      severity: 'attention',
      title: 'Your body may need extra recovery',
      message:
        'HRV is down and resting heart rate is up compared with your usual. Consider an easier day, more water and an early night.',
    });
  }
  for (const item of [
    hrv,
    rhr,
    sleepDurationInsight(compare(points, 'totalSleepMinutes', todayNumber), targets.sleepMinutes),
    sleepScoreInsight(compare(points, 'sleepScore', todayNumber), targets.sleepScore),
    workoutInsight(weeklyWorkoutCount, targets.weeklyWorkouts),
  ]) {
    if (item) items.push(item);
  }

  if (latestDataDate !== null) {
    const staleDays = todayNumber - dayNumber(latestDataDate);
    if (staleDays >= STALE_AFTER_DAYS) {
      items.push({
        key: 'stale-data',
        severity: 'info',
        title: 'No fresh data',
        message: `Your last data is from ${staleDays} days ago. Open the app on your phone or sync your device to refresh these insights.`,
      });
    }
  }

  items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  let headline: string;
  if (latestDataDate === null) {
    headline = 'Connect a device to get your daily summary.';
  } else if (!hasEnoughHistory && items.every((i) => i.key === 'stale-data')) {
    headline = `Building your personal baseline — ${baselineDays} of ${MIN_BASELINE_VALUES} days so far.`;
  } else if (items.some((i) => i.severity === 'attention')) {
    headline = 'A few things are worth keeping an eye on today.';
  } else if (items.some((i) => i.severity === 'good')) {
    headline = 'Looking good — you are on track.';
  } else if (items.some((i) => i.key === 'stale-data')) {
    headline = 'Waiting for fresh data to update your summary.';
  } else if (!hasEnoughHistory) {
    headline = `Building your personal baseline — ${baselineDays} of ${MIN_BASELINE_VALUES} days so far.`;
  } else {
    headline = 'Everything is close to your usual.';
  }

  return { headline, items, latestDataDate, baselineDays, hasEnoughHistory };
}
