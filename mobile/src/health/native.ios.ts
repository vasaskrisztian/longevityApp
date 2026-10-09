import {
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryStatisticsCollectionForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import {
  addDays,
  aggregateSleep,
  buildDailySamples,
  localDayKey,
  startOfLocalDay,
  type DayValueMap,
  type SleepSampleLike,
} from './aggregate';
import type { AppleHealthNative } from './types';

const STEPS = 'HKQuantityTypeIdentifierStepCount' as const;
const ACTIVE_ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;
const BASAL_ENERGY = 'HKQuantityTypeIdentifierBasalEnergyBurned' as const;
const RESTING_HR = 'HKQuantityTypeIdentifierRestingHeartRate' as const;
const HRV = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' as const;
const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis' as const;

/** Read-only: we never write to Apple Health, so no `toShare`. */
const READ_TYPES = [STEPS, ACTIVE_ENERGY, BASAL_ENERGY, RESTING_HR, HRV, SLEEP] as const;

/** A failed query for one metric must not lose the others (e.g. the user denied just that type). */
async function safely<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (__DEV__) console.warn(`[AppleHealth] ${label} query failed`, error);
    return fallback;
  }
}

async function dailyStatistic(
  identifier: typeof STEPS | typeof ACTIVE_ENERGY | typeof BASAL_ENERGY | typeof RESTING_HR | typeof HRV,
  kind: 'cumulativeSum' | 'discreteAverage',
  unit: string,
  from: Date,
  to: Date,
): Promise<DayValueMap> {
  const buckets = await queryStatisticsCollectionForQuantity(
    identifier,
    [kind],
    startOfLocalDay(from),
    { day: 1 },
    // `unit` is one fixed, valid HealthKit unit per identifier (see callers).
    { filter: { date: { startDate: from, endDate: to } }, unit: unit as never },
  );
  const map: DayValueMap = new Map();
  for (const bucket of buckets) {
    const quantity = kind === 'cumulativeSum' ? bucket.sumQuantity : bucket.averageQuantity;
    if (bucket.startDate && quantity && Number.isFinite(quantity.quantity)) {
      map.set(localDayKey(bucket.startDate), quantity.quantity);
    }
  }
  return map;
}

const native: AppleHealthNative = {
  async isSupported() {
    try {
      return await isHealthDataAvailableAsync();
    } catch {
      return false;
    }
  },

  async requestAccess() {
    return requestAuthorization({ toRead: READ_TYPES });
  },

  async readDailySummaries(from, to) {
    const start = startOfLocalDay(from);
    const [steps, activeCalories, basalCalories, restingHeartRate, hrv, sleepSamples] = await Promise.all([
      safely('steps', () => dailyStatistic(STEPS, 'cumulativeSum', 'count', start, to), new Map()),
      safely('active energy', () => dailyStatistic(ACTIVE_ENERGY, 'cumulativeSum', 'kcal', start, to), new Map()),
      safely('basal energy', () => dailyStatistic(BASAL_ENERGY, 'cumulativeSum', 'kcal', start, to), new Map()),
      safely('resting heart rate', () => dailyStatistic(RESTING_HR, 'discreteAverage', 'count/min', start, to), new Map()),
      safely('HRV', () => dailyStatistic(HRV, 'discreteAverage', 'ms', start, to), new Map()),
      safely(
        'sleep',
        async () => {
          // Start a day early so a night that began before `from` is still complete.
          const samples = await queryCategorySamples(SLEEP, {
            limit: 0,
            ascending: true,
            filter: { date: { startDate: addDays(start, -1), endDate: to } },
          });
          return samples.map<SleepSampleLike>((s) => ({
            startDate: s.startDate,
            endDate: s.endDate,
            value: Number(s.value),
          }));
        },
        [] as SleepSampleLike[],
      ),
    ]);

    return buildDailySamples(
      { steps, activeCalories, basalCalories, restingHeartRate, hrv, sleep: aggregateSleep(sleepSamples) },
      localDayKey(start),
      localDayKey(to),
    );
  },
};

export default native;
