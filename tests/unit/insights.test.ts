import { describe, it, expect } from 'vitest';
import {
  computeInsights,
  formatMinutes,
  type InsightInput,
  type InsightMetricPoint,
} from '@/modules/dashboard/insights';

const TODAY = '2026-10-13';

function dayKey(daysAgo: number): string {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** One point per day for ages [from..to] (0 = today), values from `fn(age)`. */
function series(
  from: number,
  to: number,
  fn: (age: number) => Partial<Omit<InsightMetricPoint, 'date'>>,
): InsightMetricPoint[] {
  const out: InsightMetricPoint[] = [];
  for (let age = from; age <= to; age++) {
    out.push({
      date: dayKey(age),
      sleepScore: null,
      totalSleepMinutes: null,
      restingHeartRate: null,
      averageHrv: null,
      ...fn(age),
    });
  }
  return out;
}

const NO_TARGETS = { sleepScore: null, sleepMinutes: null, weeklyWorkouts: null };

function run(points: InsightMetricPoint[], extra: Partial<InsightInput> = {}) {
  return computeInsights({ points, targets: NO_TARGETS, weeklyWorkoutCount: null, today: TODAY, ...extra });
}

// Baseline HRV alternates 58/62 (mean 60, sd ~2); resting HR 54/56 (mean 55).
const baseline = (age: number) => ({
  averageHrv: age % 2 === 0 ? 58 : 62,
  restingHeartRate: age % 2 === 0 ? 54 : 56,
  totalSleepMinutes: 450,
  sleepScore: 82,
});

describe('formatMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutes(450)).toBe('7h 30m');
    expect(formatMinutes(480)).toBe('8h');
    expect(formatMinutes(45)).toBe('45m');
  });
});

describe('computeInsights', () => {
  it('says to connect a device when there is no data at all', () => {
    const result = run(series(0, 32, () => ({})));
    expect(result.items).toEqual([]);
    expect(result.latestDataDate).toBeNull();
    expect(result.headline).toMatch(/connect a device/i);
  });

  it('reports baseline progress and makes no baseline comparison with too little history', () => {
    const points = [...series(3, 6, baseline), ...series(0, 2, () => ({ averageHrv: 30, restingHeartRate: 70 }))];
    const result = run(points);
    expect(result.hasEnoughHistory).toBe(false);
    expect(result.baselineDays).toBe(4);
    expect(result.items.find((i) => i.key === 'hrv')).toBeUndefined();
    expect(result.headline).toBe('Building your personal baseline — 4 of 7 days so far.');
  });

  it('stays quiet when recent values are close to the baseline', () => {
    const points = [...series(3, 32, baseline), ...series(0, 2, () => ({ averageHrv: 60, restingHeartRate: 55, totalSleepMinutes: 450, sleepScore: 82 }))];
    const result = run(points);
    expect(result.hasEnoughHistory).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.headline).toBe('Everything is close to your usual.');
  });

  it('flags a clearly lower HRV and higher resting HR, plus the combined recovery hint first', () => {
    const points = [...series(3, 32, baseline), ...series(0, 2, () => ({ averageHrv: 45, restingHeartRate: 61 }))];
    const result = run(points);
    const keys = result.items.map((i) => i.key);
    expect(keys[0]).toBe('recovery');
    expect(keys).toEqual(expect.arrayContaining(['hrv', 'resting-hr']));
    expect(result.items.every((i) => i.severity === 'attention')).toBe(true);
    expect(result.items.find((i) => i.key === 'hrv')!.message).toContain('45 ms');
    expect(result.items.find((i) => i.key === 'hrv')!.message).toContain('60 ms');
    expect(result.items.find((i) => i.key === 'resting-hr')!.message).toContain('+6 bpm');
    expect(result.headline).toMatch(/keeping an eye on/);
  });

  it('praises a higher HRV and lower resting HR without the recovery warning', () => {
    const points = [...series(3, 32, baseline), ...series(0, 2, () => ({ averageHrv: 75, restingHeartRate: 50 }))];
    const result = run(points);
    expect(result.items.map((i) => i.severity)).toEqual(['good', 'good']);
    expect(result.items.some((i) => i.key === 'recovery')).toBe(false);
    expect(result.headline).toMatch(/Looking good/);
  });

  it('does not flag a resting HR move of only 2 bpm', () => {
    const points = [...series(3, 32, baseline), ...series(0, 2, () => ({ restingHeartRate: 57 }))];
    expect(run(points).items.find((i) => i.key === 'resting-hr')).toBeUndefined();
  });

  it('needs at least two recent values per metric', () => {
    const points = [...series(3, 32, baseline), ...series(1, 2, () => ({})), ...series(0, 0, () => ({ averageHrv: 30 }))];
    expect(run(points).items.find((i) => i.key === 'hrv')).toBeUndefined();
  });

  it('compares sleep duration and score with the protocol targets', () => {
    const points = series(0, 2, () => ({ totalSleepMinutes: 380, sleepScore: 70 }));
    const result = run(points, { targets: { sleepScore: 85, sleepMinutes: 450, weeklyWorkouts: null } });
    const duration = result.items.find((i) => i.key === 'sleep-duration')!;
    expect(duration.severity).toBe('attention');
    expect(duration.message).toContain('6h 20m');
    expect(duration.message).toContain('1h 10m under your 7h 30m target');
    expect(result.items.find((i) => i.key === 'sleep-score')!.severity).toBe('attention');
  });

  it('marks on-target sleep as good', () => {
    const points = series(0, 2, () => ({ totalSleepMinutes: 440, sleepScore: 88 }));
    const result = run(points, { targets: { sleepScore: 85, sleepMinutes: 450, weeklyWorkouts: null } });
    expect(result.items.map((i) => [i.key, i.severity])).toEqual(
      expect.arrayContaining([['sleep-duration', 'good'], ['sleep-score', 'good']]),
    );
    expect(result.headline).toMatch(/Looking good/);
  });

  it('falls back to the personal baseline for sleep when there is no protocol target', () => {
    const points = [...series(3, 32, baseline), ...series(0, 2, () => ({ totalSleepMinutes: 380, sleepScore: 70 }))];
    const result = run(points);
    expect(result.items.find((i) => i.key === 'sleep-duration')!.title).toBe('Sleeping less than usual');
    expect(result.items.find((i) => i.key === 'sleep-score')!.title).toBe('Sleep score dipped');
  });

  it('reports workout progress against the weekly target', () => {
    const points = series(0, 2, () => ({ sleepScore: 80 }));
    const open = run(points, { weeklyWorkoutCount: 2, targets: { ...NO_TARGETS, weeklyWorkouts: 4 } });
    expect(open.items.find((i) => i.key === 'workouts')).toMatchObject({ severity: 'info', message: '2 of 4 workouts in the last 7 days — 2 to go.' });
    const done = run(points, { weeklyWorkoutCount: 4, targets: { ...NO_TARGETS, weeklyWorkouts: 4 } });
    expect(done.items.find((i) => i.key === 'workouts')!.severity).toBe('good');
    expect(run(points, { weeklyWorkoutCount: 4 }).items.find((i) => i.key === 'workouts')).toBeUndefined();
  });

  it('hints at stale data and does not call the summary "usual" then', () => {
    const points = series(5, 34, baseline);
    const result = run(points);
    expect(result.latestDataDate).toBe(dayKey(5));
    const stale = result.items.find((i) => i.key === 'stale-data')!;
    expect(stale.severity).toBe('info');
    expect(stale.message).toContain('5 days ago');
    expect(result.headline).toBe('Waiting for fresh data to update your summary.');
  });

  it('orders attention before good before info', () => {
    const points = [...series(3, 32, baseline), ...series(0, 2, () => ({ averageHrv: 75, totalSleepMinutes: 380 }))];
    const result = run(points, { weeklyWorkoutCount: 1, targets: { sleepScore: null, sleepMinutes: 450, weeklyWorkouts: 3 } });
    expect(result.items.map((i) => i.severity)).toEqual(['attention', 'good', 'info']);
  });

  it('ignores points dated in the future', () => {
    const points = [...series(3, 32, baseline), { date: dayKey(-1), sleepScore: 1, totalSleepMinutes: null, restingHeartRate: null, averageHrv: 1 }];
    expect(run(points).latestDataDate).toBe(dayKey(3));
  });
});
