/**
 * Pure helpers that turn Android Health Connect readings into the inputs of
 * `buildDailySamples` / `aggregateSleep` (aggregate.ts), which already produce
 * the per-day summaries the backend expects. No native imports here, so it is
 * fully unit-testable off-device (the native reads live in
 * healthConnectNative.android.ts).
 */
import { SleepValue, localDayKey, type DayValueMap, type SleepSampleLike } from './aggregate';

/** Health Connect `SleepSessionRecord.Stage` types (the library's SleepStageType plus AWAKE_IN_BED = 7). */
export const HcSleepStage = {
  UNKNOWN: 0,
  AWAKE: 1,
  SLEEPING: 2,
  OUT_OF_BED: 3,
  LIGHT: 4,
  DEEP: 5,
  REM: 6,
  AWAKE_IN_BED: 7,
} as const;

export interface HcSleepStageLike {
  startTime: string;
  endTime: string;
  stage: number;
}

export interface HcSleepSessionLike {
  startTime: string;
  endTime: string;
  stages?: HcSleepStageLike[];
}

/** Maps a Health Connect stage onto the HealthKit-style value `aggregateSleep` understands; null = not sleep-related. */
export function stageToSleepValue(stage: number): number | null {
  switch (stage) {
    case HcSleepStage.DEEP:
      return SleepValue.asleepDeep;
    case HcSleepStage.REM:
      return SleepValue.asleepREM;
    case HcSleepStage.LIGHT:
      return SleepValue.asleepCore;
    case HcSleepStage.SLEEPING:
    case HcSleepStage.UNKNOWN:
      return SleepValue.asleepUnspecified;
    case HcSleepStage.AWAKE:
    case HcSleepStage.AWAKE_IN_BED:
      return SleepValue.awake;
    default:
      // OUT_OF_BED (and anything newer we do not know) is not time in bed asleep.
      return null;
  }
}

/**
 * Flattens sleep sessions into sleep samples. A session without stages (many
 * trackers only report start and end) counts as one block of unspecified sleep.
 * Overlapping samples from several sources are resolved later by aggregateSleep.
 */
export function sleepSessionsToSamples(sessions: readonly HcSleepSessionLike[]): SleepSampleLike[] {
  const samples: SleepSampleLike[] = [];
  for (const session of sessions) {
    const stages = session.stages ?? [];
    if (stages.length === 0) {
      samples.push({
        startDate: new Date(session.startTime),
        endDate: new Date(session.endTime),
        value: SleepValue.asleepUnspecified,
      });
      continue;
    }
    for (const stage of stages) {
      const value = stageToSleepValue(stage.stage);
      if (value === null) continue;
      samples.push({ startDate: new Date(stage.startTime), endDate: new Date(stage.endTime), value });
    }
  }
  return samples.filter(
    (s) => Number.isFinite(s.startDate.getTime()) && Number.isFinite(s.endDate.getTime()),
  );
}

export interface HcPeriodGroupLike<R> {
  /** Local date-time of the day's start, e.g. "2026-11-06T00:00" (a Java LocalDateTime string). */
  startTime: string;
  result: R;
}

/**
 * One value per local day from `aggregateGroupByPeriod` groups. The library
 * reports a missing metric as 0, and a day with no data is indistinguishable
 * from a real zero — so zero and non-finite values are dropped (the same as
 * "no data" for steps, calories and resting heart rate).
 */
export function dayValueMapFromGroups<R>(
  groups: readonly HcPeriodGroupLike<R>[],
  pick: (result: R) => number | undefined,
): DayValueMap {
  const map: DayValueMap = new Map();
  for (const group of groups) {
    const day = /^\d{4}-\d{2}-\d{2}/.exec(group.startTime)?.[0];
    if (!day) continue;
    const value = pick(group.result);
    if (value !== undefined && Number.isFinite(value) && value > 0) map.set(day, value);
  }
  return map;
}

export interface HcInstantSampleLike {
  time: string;
  value: number;
}

/** Average per local day of instantaneous samples (heart rate variability). */
export function averageByLocalDay(samples: readonly HcInstantSampleLike[]): DayValueMap {
  const sums = new Map<string, { total: number; count: number }>();
  for (const sample of samples) {
    const when = new Date(sample.time);
    if (Number.isNaN(when.getTime()) || !Number.isFinite(sample.value) || sample.value <= 0) continue;
    const key = localDayKey(when);
    const entry = sums.get(key) ?? { total: 0, count: 0 };
    entry.total += sample.value;
    entry.count += 1;
    sums.set(key, entry);
  }
  const map: DayValueMap = new Map();
  sums.forEach((entry, key) => map.set(key, entry.total / entry.count));
  return map;
}
