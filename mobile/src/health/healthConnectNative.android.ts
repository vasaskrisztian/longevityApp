import {
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
  type RecordType,
} from 'react-native-health-connect';

import { addDays, buildDailySamples, localDayKey, aggregateSleep, startOfLocalDay, type DayValueMap } from './aggregate';
import {
  averageByLocalDay,
  dayValueMapFromGroups,
  sleepSessionsToSamples,
  type HcSleepSessionLike,
} from './healthConnectAggregate';
import type { HealthConnectAccess, HealthConnectNative } from './healthConnectTypes';

/** Read-only: we never write to Health Connect. */
const CORE_RECORD_TYPES = [
  'Steps',
  'ActiveCaloriesBurned',
  'TotalCaloriesBurned',
  'RestingHeartRate',
  'HeartRateVariabilityRmssd',
  'SleepSession',
] as const satisfies readonly RecordType[];

const CORE_PERMISSIONS: Permission[] = CORE_RECORD_TYPES.map((recordType) => ({ accessType: 'read', recordType }));

// Special permissions (not record types): reading from a background job, and
// reading data older than 30 days before the first grant.
const BACKGROUND_PERMISSION = { accessType: 'read', recordType: 'BackgroundAccessPermission' } as const;
const HISTORY_PERMISSION = { accessType: 'read', recordType: 'ReadHealthDataHistory' } as const;

/** Without the history permission Health Connect only serves the last 30 days before the first grant. */
const NO_HISTORY_DAYS = 30;

let initialized: Promise<boolean> | null = null;
function ensureInitialized(): Promise<boolean> {
  if (!initialized) {
    initialized = initialize().catch(() => {
      initialized = null; // try again next time (e.g. Health Connect was installed meanwhile)
      return false;
    });
  }
  return initialized;
}

/** A failed read of one metric must not lose the others (e.g. the user denied just that type). */
async function safely<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (__DEV__) console.warn(`[HealthConnect] ${label} read failed`, error);
    return fallback;
  }
}

type Granted = { accessType?: string; recordType?: string };

async function grantedPermissions(): Promise<Granted[]> {
  try {
    return (await getGrantedPermissions()) as Granted[];
  } catch {
    return [];
  }
}

function accessFrom(granted: readonly Granted[]): HealthConnectAccess {
  const has = (recordType: string) => granted.some((g) => g.accessType === 'read' && g.recordType === recordType);
  return {
    granted: CORE_RECORD_TYPES.some(has),
    background: has(BACKGROUND_PERMISSION.recordType),
    history: has(HISTORY_PERMISSION.recordType),
  };
}

async function dailyAggregate<R>(
  recordType: 'Steps' | 'ActiveCaloriesBurned' | 'TotalCaloriesBurned' | 'RestingHeartRate',
  range: { operator: 'between'; startTime: string; endTime: string },
  pick: (result: R) => number | undefined,
): Promise<DayValueMap> {
  const groups = await aggregateGroupByPeriod({
    recordType,
    timeRangeFilter: range,
    timeRangeSlicer: { period: 'DAYS', length: 1 },
  } as never);
  return dayValueMapFromGroups(groups as unknown as { startTime: string; result: R }[], pick);
}

/** Reads every page of a record type in a time range. */
async function readAll<T extends RecordType>(
  recordType: T,
  range: { operator: 'between'; startTime: string; endTime: string },
) {
  const records: Awaited<ReturnType<typeof readRecords<T>>>['records'] = [];
  let pageToken: string | undefined;
  do {
    const page = await readRecords(recordType, { timeRangeFilter: range, pageSize: 1000, pageToken });
    records.push(...page.records);
    pageToken = page.pageToken || undefined;
  } while (pageToken && records.length < 100_000);
  return records;
}

const native: HealthConnectNative = {
  async availability() {
    try {
      const status = await getSdkStatus();
      if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_required';
      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  },

  async getAccess() {
    if (!(await ensureInitialized())) return { granted: false, background: false, history: false };
    return accessFrom(await grantedPermissions());
  },

  async requestAccess() {
    if (!(await ensureInitialized())) return { granted: false, background: false, history: false };
    try {
      await requestPermission(CORE_PERMISSIONS);
    } catch {
      // The user closed the screen or Health Connect is unavailable — read what is granted below.
    }
    let access = accessFrom(await grantedPermissions());
    if (access.granted && (!access.background || !access.history)) {
      // Optional extras, asked separately so a refusal (or a phone that does not offer them) never costs the core access.
      try {
        await requestPermission([BACKGROUND_PERMISSION, HISTORY_PERMISSION] as never);
      } catch {
        // Not offered on this Android / Health Connect version.
      }
      access = accessFrom(await grantedPermissions());
    }
    return access;
  },

  async readDailySummaries(from, to) {
    if (!(await ensureInitialized())) return [];
    const access = accessFrom(await grantedPermissions());
    let start = startOfLocalDay(from);
    if (!access.history) {
      const earliest = addDays(startOfLocalDay(to), -(NO_HISTORY_DAYS - 1));
      if (start < earliest) start = earliest;
    }
    const range = { operator: 'between', startTime: start.toISOString(), endTime: to.toISOString() } as const;
    // Start a day early so a night that began before `start` is still complete.
    const sleepRange = { ...range, startTime: addDays(start, -1).toISOString() };

    const [steps, activeCalories, totalCalories, restingHeartRate, hrv, sleepSessions] = await Promise.all([
      safely('steps', () => dailyAggregate<{ COUNT_TOTAL?: number }>('Steps', range, (r) => r.COUNT_TOTAL), new Map()),
      safely(
        'active calories',
        () =>
          dailyAggregate<{ ACTIVE_CALORIES_TOTAL?: { inKilocalories?: number } }>(
            'ActiveCaloriesBurned',
            range,
            (r) => r.ACTIVE_CALORIES_TOTAL?.inKilocalories,
          ),
        new Map(),
      ),
      safely(
        'total calories',
        () =>
          dailyAggregate<{ ENERGY_TOTAL?: { inKilocalories?: number } }>(
            'TotalCaloriesBurned',
            range,
            (r) => r.ENERGY_TOTAL?.inKilocalories,
          ),
        new Map(),
      ),
      safely(
        'resting heart rate',
        () => dailyAggregate<{ BPM_AVG?: number }>('RestingHeartRate', range, (r) => r.BPM_AVG),
        new Map(),
      ),
      safely(
        'HRV',
        async () => {
          const records = await readAll('HeartRateVariabilityRmssd', range);
          return averageByLocalDay(
            records.map((r) => ({ time: String((r as { time: string }).time), value: Number(r.heartRateVariabilityMillis) })),
          );
        },
        new Map(),
      ),
      safely(
        'sleep',
        async () => (await readAll('SleepSession', sleepRange)) as unknown as HcSleepSessionLike[],
        [] as HcSleepSessionLike[],
      ),
    ]);

    return buildDailySamples(
      {
        steps,
        activeCalories,
        totalCalories,
        restingHeartRate,
        hrv,
        sleep: aggregateSleep(sleepSessionsToSamples(sleepSessions)),
      },
      localDayKey(start),
      localDayKey(to),
    );
  },

  openSettings() {
    try {
      openHealthConnectSettings();
    } catch {
      // Nothing to open (Health Connect not installed).
    }
  },
};

export default native;
