/**
 * Pure aggregation of HealthKit readings into the per-day summaries the
 * backend expects (`AppleHealthDailySampleSchema`, see
 * src/lib/validation/apple-health.schemas.ts). No native imports here on
 * purpose, so this is fully unit-testable off-device.
 */

export interface AppleHealthDailySample {
  /** Device-local calendar day, "yyyy-mm-dd". */
  date: string;
  steps?: number;
  activeCalories?: number;
  totalCalories?: number;
  restingHeartRate?: number;
  averageHrv?: number;
  totalSleepMinutes?: number;
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  lightSleepMinutes?: number;
  awakeMinutes?: number;
  sleepEfficiencyPct?: number;
  /** ISO 8601 timestamps. */
  bedtimeStart?: string;
  bedtimeEnd?: string;
}

/** HKCategoryValueSleepAnalysis raw values. */
export const SleepValue = {
  inBed: 0,
  asleepUnspecified: 1,
  awake: 2,
  asleepCore: 3,
  asleepDeep: 4,
  asleepREM: 5,
} as const;

export interface SleepSampleLike {
  startDate: Date;
  endDate: Date;
  value: number;
}

export type DayValueMap = Map<string, number>;

const MINUTE_MS = 60_000;
/** Segments closer together than this belong to the same sleep session. */
const SESSION_GAP_MS = 2 * 60 * MINUTE_MS;

const pad = (n: number) => String(n).padStart(2, '0');

/** Device-local "yyyy-mm-dd" for an instant. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of the day containing `date`. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Same wall-clock time `days` calendar days later (DST-safe, unlike adding 24 h). */
export function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  );
}

// Higher wins when samples from several sources (iPhone, Watch, Oura, …)
// overlap in time, so no minute is ever counted twice.
const PRIORITY: Record<number, number> = {
  [SleepValue.asleepDeep]: 6,
  [SleepValue.asleepREM]: 5,
  [SleepValue.asleepCore]: 4,
  [SleepValue.asleepUnspecified]: 3,
  [SleepValue.awake]: 2,
  [SleepValue.inBed]: 1,
};

interface Segment {
  start: number;
  end: number;
  value: number;
}

/** Flattens overlapping samples into non-overlapping segments (highest priority wins). */
function flatten(samples: readonly SleepSampleLike[]): Segment[] {
  const valid = samples.filter(
    (s) => PRIORITY[s.value] !== undefined && s.endDate.getTime() > s.startDate.getTime(),
  );
  if (valid.length === 0) return [];
  const bounds = Array.from(
    new Set(valid.flatMap((s) => [s.startDate.getTime(), s.endDate.getTime()])),
  ).sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i];
    const end = bounds[i + 1];
    let best: number | null = null;
    for (const s of valid) {
      if (s.startDate.getTime() <= start && s.endDate.getTime() >= end) {
        if (best === null || PRIORITY[s.value] > PRIORITY[best]) best = s.value;
      }
    }
    if (best === null) continue;
    const last = segments[segments.length - 1];
    if (last && last.end === start && last.value === best) last.end = end;
    else segments.push({ start, end, value: best });
  }
  return segments;
}

interface SleepNight {
  totalSleepMinutes: number;
  deepSleepMinutes: number;
  remSleepMinutes: number;
  lightSleepMinutes: number;
  awakeMinutes: number;
  inBedMinutes: number;
  start: number;
  end: number;
}

const mins = (ms: number) => ms / MINUTE_MS;

/**
 * Groups sleep samples into sessions (gaps > 2 h split them) and attributes
 * each session to the local calendar day it ENDS on — i.e. last night's sleep
 * belongs to the morning you woke up. A daytime nap adds to its own day.
 */
export function aggregateSleep(samples: readonly SleepSampleLike[]): Map<string, Partial<AppleHealthDailySample>> {
  const segments = flatten(samples);
  const sessions: Segment[][] = [];
  for (const seg of segments) {
    const current = sessions[sessions.length - 1];
    if (current && seg.start - current[current.length - 1].end <= SESSION_GAP_MS) current.push(seg);
    else sessions.push([seg]);
  }

  const nights = new Map<string, SleepNight>();
  for (const session of sessions) {
    const start = session[0].start;
    const end = session[session.length - 1].end;
    const key = localDayKey(new Date(end));
    const night =
      nights.get(key) ??
      ({
        totalSleepMinutes: 0,
        deepSleepMinutes: 0,
        remSleepMinutes: 0,
        lightSleepMinutes: 0,
        awakeMinutes: 0,
        inBedMinutes: 0,
        start: Infinity,
        end: -Infinity,
      } satisfies SleepNight);

    let sawAsleep = false;
    for (const seg of session) {
      const m = mins(seg.end - seg.start);
      switch (seg.value) {
        case SleepValue.asleepDeep:
          night.deepSleepMinutes += m;
          night.totalSleepMinutes += m;
          sawAsleep = true;
          break;
        case SleepValue.asleepREM:
          night.remSleepMinutes += m;
          night.totalSleepMinutes += m;
          sawAsleep = true;
          break;
        case SleepValue.asleepCore:
          night.lightSleepMinutes += m;
          night.totalSleepMinutes += m;
          sawAsleep = true;
          break;
        case SleepValue.asleepUnspecified:
          night.totalSleepMinutes += m;
          sawAsleep = true;
          break;
        case SleepValue.awake:
          night.awakeMinutes += m;
          break;
        case SleepValue.inBed:
          night.inBedMinutes += m;
          break;
      }
    }
    // An "in bed" only session (no sleep data at all) is not a night of sleep.
    if (!sawAsleep) continue;
    night.start = Math.min(night.start, start);
    night.end = Math.max(night.end, end);
    nights.set(key, night);
  }

  const result = new Map<string, Partial<AppleHealthDailySample>>();
  for (const [key, n] of nights) {
    // Efficiency = asleep / time in bed. Time in bed is everything the session
    // covers — asleep + awake + any in-bed time not overlapped by a sleep stage.
    const timeInBed = n.totalSleepMinutes + n.awakeMinutes + n.inBedMinutes;
    const efficiency = timeInBed > 0 ? Math.min(100, (n.totalSleepMinutes / timeInBed) * 100) : undefined;
    result.set(key, {
      totalSleepMinutes: Math.min(1440, Math.round(n.totalSleepMinutes)),
      deepSleepMinutes: n.deepSleepMinutes > 0 ? Math.min(1440, Math.round(n.deepSleepMinutes)) : undefined,
      remSleepMinutes: n.remSleepMinutes > 0 ? Math.min(1440, Math.round(n.remSleepMinutes)) : undefined,
      lightSleepMinutes: n.lightSleepMinutes > 0 ? Math.min(1440, Math.round(n.lightSleepMinutes)) : undefined,
      awakeMinutes: n.awakeMinutes > 0 ? Math.min(1440, Math.round(n.awakeMinutes)) : undefined,
      sleepEfficiencyPct: efficiency !== undefined ? Math.round(efficiency * 10) / 10 : undefined,
      bedtimeStart: new Date(n.start).toISOString(),
      bedtimeEnd: new Date(n.end).toISOString(),
    });
  }
  return result;
}

export interface DailyInputs {
  steps?: DayValueMap;
  activeCalories?: DayValueMap;
  basalCalories?: DayValueMap;
  restingHeartRate?: DayValueMap;
  hrv?: DayValueMap;
  sleep?: Map<string, Partial<AppleHealthDailySample>>;
}

const finite = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v);

/** Merges every metric into one summary per day; days with no data are dropped. Ascending by date. */
export function buildDailySamples(inputs: DailyInputs, fromDay: string, toDay: string): AppleHealthDailySample[] {
  const days = new Set<string>();
  for (const map of [inputs.steps, inputs.activeCalories, inputs.basalCalories, inputs.restingHeartRate, inputs.hrv]) {
    map?.forEach((_, k) => days.add(k));
  }
  inputs.sleep?.forEach((_, k) => days.add(k));

  const out: AppleHealthDailySample[] = [];
  for (const date of Array.from(days).sort()) {
    if (date < fromDay || date > toDay) continue;
    const steps = inputs.steps?.get(date);
    const active = inputs.activeCalories?.get(date);
    const basal = inputs.basalCalories?.get(date);
    const rhr = inputs.restingHeartRate?.get(date);
    const hrv = inputs.hrv?.get(date);
    const sleep = inputs.sleep?.get(date);

    const sample: AppleHealthDailySample = { date };
    if (finite(steps) && steps >= 0) sample.steps = Math.min(200_000, Math.round(steps));
    if (finite(active) && active >= 0) sample.activeCalories = Math.min(20_000, Math.round(active));
    if (finite(active) && finite(basal) && active >= 0 && basal >= 0) {
      sample.totalCalories = Math.min(20_000, Math.round(active + basal));
    }
    if (finite(rhr) && rhr >= 20 && rhr <= 250) sample.restingHeartRate = Math.round(rhr);
    if (finite(hrv) && hrv >= 0) sample.averageHrv = Math.min(500, Math.round(hrv * 10) / 10);
    if (sleep) {
      for (const [k, v] of Object.entries(sleep)) {
        if (v !== undefined) (sample as unknown as Record<string, unknown>)[k] = v;
      }
    }
    if (Object.keys(sample).length > 1) out.push(sample);
  }
  return out;
}
