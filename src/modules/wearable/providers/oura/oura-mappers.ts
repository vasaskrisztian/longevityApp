import type {
  NormalizedDailyMetric,
  NormalizedWorkout,
  ProviderRawRecord,
} from '../../domain/wearable-provider.types';
import type {
  OuraDailyActivityRecord,
  OuraDailyReadinessRecord,
  OuraDailySleepRecord,
  OuraDailySpo2Record,
  OuraSleepSessionRecord,
  OuraWorkoutRecord,
} from './oura-data-types';

/**
 * The only place Oura's raw JSON payloads are ever interpreted. Pure
 * functions — no I/O, no Prisma — so modules/wearable/services/
 * normalization.service.ts can call these (via the adapter interface) and
 * upsert the result without ever knowing what an Oura payload looks like.
 */

// Oura payloads for this dataType are not always shaped the way the type
// declares: a live-confirmed production case had a record tagged
// DAILY_SLEEP whose payload was actually shaped like a DAILY_READINESS
// record (contributors.*, no bedtime_start/bedtime_end/total_sleep_duration
// at all). `new Date(undefined)` silently builds an Invalid Date (no
// throw), and `Math.round(undefined / 60)` silently builds NaN — both sail
// straight through normalization.service.ts's `!== undefined` filter and
// out to the database, and were confirmed (via a temporary diagnostic) to
// be the values sent right before the sync write path's long-standing
// freeze. Every field below is therefore built to fall back to `undefined`
// on a missing source value, not to a computed placeholder, so a
// malformed/partial payload just contributes fewer fields to this date's
// merge instead of poisoning it with Invalid Date/NaN.
function secondsToMinutes(seconds: number | undefined): number | undefined {
  return seconds === undefined ? undefined : Math.round(seconds / 60);
}

function toDateOrUndefined(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

/** Number or undefined (Oura sends null for a value it could not measure). */
function numberOrUndefined(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Oura's `sleep` endpoint returns every sleep period, and a day can have a
 * main night plus naps. One record per day represents the night: the longest
 * `long_sleep`, otherwise the longest `sleep`; naps (`late_nap`), `rest`
 * periods and `deleted` records never set the day's HRV / resting heart rate /
 * duration. (The `type` field is absent on some older records — those count
 * as `sleep`.)
 */
export function pickPrimarySleepSessions(sessions: OuraSleepSessionRecord[]): OuraSleepSessionRecord[] {
  const rank = (s: OuraSleepSessionRecord): number => {
    const type = s.type ?? 'sleep';
    if (type === 'long_sleep') return 2;
    if (type === 'sleep') return 1;
    return 0;
  };
  const best = new Map<string, OuraSleepSessionRecord>();
  for (const session of sessions) {
    if (rank(session) === 0 || !session.day) continue;
    const current = best.get(session.day);
    if (
      !current ||
      rank(session) > rank(current) ||
      (rank(session) === rank(current) &&
        (numberOrUndefined(session.total_sleep_duration) ?? 0) > (numberOrUndefined(current.total_sleep_duration) ?? 0))
    ) {
      best.set(session.day, session);
    }
  }
  return [...best.values()].sort((a, b) => a.day.localeCompare(b.day));
}

function looksLikeSleepSession(payload: Record<string, unknown>): boolean {
  return 'average_hrv' in payload || 'lowest_heart_rate' in payload || 'total_sleep_duration' in payload;
}

function mapSleepSession(record: ProviderRawRecord): NormalizedDailyMetric | null {
  const payload = record.payload as OuraSleepSessionRecord;
  return {
    date: record.dataDate,
    fields: {
      totalSleepMinutes: secondsToMinutes(numberOrUndefined(payload.total_sleep_duration)),
      deepSleepMinutes: secondsToMinutes(numberOrUndefined(payload.deep_sleep_duration)),
      remSleepMinutes: secondsToMinutes(numberOrUndefined(payload.rem_sleep_duration)),
      lightSleepMinutes: secondsToMinutes(numberOrUndefined(payload.light_sleep_duration)),
      awakeMinutes: secondsToMinutes(numberOrUndefined(payload.awake_time)),
      sleepEfficiencyPct: numberOrUndefined(payload.efficiency),
      sleepLatencyMinutes: secondsToMinutes(numberOrUndefined(payload.latency)),
      bedtimeStart: toDateOrUndefined(payload.bedtime_start),
      bedtimeEnd: toDateOrUndefined(payload.bedtime_end),
      restingHeartRate: numberOrUndefined(payload.lowest_heart_rate),
      averageHrv: numberOrUndefined(payload.average_hrv),
    },
  };
}

export function mapOuraRecordToDailyMetric(record: ProviderRawRecord): NormalizedDailyMetric | null {
  switch (record.dataType) {
    case 'DAILY_SLEEP': {
      const payload = record.payload as OuraDailySleepRecord;
      return {
        date: record.dataDate,
        fields: {
          sleepScore: payload.score,
          totalSleepMinutes: secondsToMinutes(payload.total_sleep_duration),
          deepSleepMinutes: secondsToMinutes(payload.deep_sleep_duration),
          remSleepMinutes: secondsToMinutes(payload.rem_sleep_duration),
          lightSleepMinutes: secondsToMinutes(payload.light_sleep_duration),
          awakeMinutes: secondsToMinutes(payload.awake_time),
          sleepEfficiencyPct: payload.efficiency,
          sleepLatencyMinutes: secondsToMinutes(payload.latency),
          bedtimeStart: toDateOrUndefined(payload.bedtime_start),
          bedtimeEnd: toDateOrUndefined(payload.bedtime_end),
          restingHeartRate: payload.lowest_heart_rate,
          averageHrv: payload.average_hrv,
        },
      };
    }
    case 'DAILY_READINESS': {
      const payload = record.payload as OuraDailyReadinessRecord;
      return {
        date: record.dataDate,
        fields: {
          readinessScore: payload.score,
          temperatureDeviationC: payload.temperature_deviation,
        },
      };
    }
    case 'DAILY_ACTIVITY': {
      const payload = record.payload as OuraDailyActivityRecord;
      return {
        date: record.dataDate,
        fields: {
          activityScore: payload.score,
          steps: payload.steps,
          activeCalories: payload.active_calories,
          totalCalories: payload.total_calories,
          walkingEquivalentMin: payload.walking_equivalent_minutes,
          sedentaryMinutes: payload.sedentary_minutes,
        },
      };
    }
    case 'SPO2': {
      const payload = record.payload as OuraDailySpo2Record;
      return {
        date: record.dataDate,
        fields: { spo2Average: payload.spo2_percentage.average },
      };
    }
    // Intraday heart-rate samples and workouts don't map to a
    // DailyHealthMetric field (workouts get their own table — see
    // mapOuraRecordToWorkout below; heart-rate has no finer-grained target
    // than restingHeartRate, which the sleep record already supplies).
    // Oura's detailed `sleep` periods are stored as dataType 'OTHER' (the
    // WearableDataType enum has no slot for them, same convention as the Apple
    // Health records): the one place HRV, resting heart rate and the sleep
    // durations really come from. `daily_sleep` only carries the score.
    case 'OTHER':
      return looksLikeSleepSession(record.payload as Record<string, unknown>) ? mapSleepSession(record) : null;
    case 'HEART_RATE':
    case 'WORKOUT':
    default:
      return null;
  }
}

export function mapOuraRecordToWorkout(record: ProviderRawRecord): NormalizedWorkout | null {
  if (record.dataType !== 'WORKOUT') {
    return null;
  }
  const payload = record.payload as OuraWorkoutRecord;
  const startedAt = new Date(payload.start_datetime);
  const endedAt = new Date(payload.end_datetime);
  return {
    externalId: record.externalId,
    activityType: payload.activity,
    startedAt,
    endedAt,
    durationMin: Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000)),
    // `workouts.calories` is a Postgres `integer` column, but Oura reports
    // calories as a float (e.g. 101.2193374633789) -- rounding here matches
    // the same "make the mapper's output actually match the column type"
    // fix applied to the DAILY_SLEEP case above, instead of letting `pg`
    // send a non-integer string to an integer column and finding out what
    // happens on the wire. `payload.calories` can be null (not just
    // undefined) -- `null !== undefined`, so an earlier version of this
    // guard let null slip through into Math.round(null), which returns 0
    // instead of leaving the value absent.
    calories: payload.calories === null || payload.calories === undefined ? undefined : Math.round(payload.calories),
    distanceM: payload.distance ?? undefined,
    intensity: payload.intensity ?? undefined,
    source: payload.source ?? undefined,
  };
}
