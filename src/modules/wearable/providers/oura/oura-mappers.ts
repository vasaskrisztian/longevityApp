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
    case 'HEART_RATE':
    case 'WORKOUT':
    case 'OTHER':
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
    calories: payload.calories ?? undefined,
    distanceM: payload.distance ?? undefined,
    intensity: payload.intensity ?? undefined,
  };
}
