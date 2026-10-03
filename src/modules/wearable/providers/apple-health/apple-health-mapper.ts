import type { AppleHealthDailySampleInput } from '@/lib/validation/apple-health.schemas';
import type { NormalizedDailyMetric, ProviderRawRecord } from '../../domain/wearable-provider.types';

/**
 * Apple Health's ingestion shape, by design, needs no provider-specific
 * unwrapping the way Oura's does (oura-mappers.ts) — the device already
 * sends data in exactly AppleHealthDailySampleSchema's normalized shape
 * (see that file's comment for why: there's no cloud payload to mirror).
 * These two functions exist anyway, mirroring Oura's raw-record pipeline
 * (store the exact payload for audit/idempotency, then map it into
 * DailyHealthMetric fields) instead of writing straight into
 * DailyHealthMetric, so Apple Health gets the same "retrying the same push
 * twice upserts, never duplicates" guarantee via WearableRawRecord's
 * (connectionId, dataType, externalId) unique constraint
 * (modules/wearable/services/raw-record.service.ts).
 *
 * `dataType: 'OTHER'` — the WearableDataType enum's existing taxonomy
 * (DAILY_SLEEP/DAILY_READINESS/DAILY_ACTIVITY/...) mirrors Oura's own
 * per-category REST endpoints; Apple Health instead sends one combined
 * per-day summary, which doesn't split into those categories, so `OTHER`
 * (already in the enum for exactly this "doesn't fit the existing
 * taxonomy" case) is the correct tag rather than adding a new Prisma enum
 * value for one provider (and this sandbox can't run `prisma migrate`
 * against a live database regardless — see claude/ci-cd-setup.md).
 */
export function appleHealthSampleToRawRecord(sample: AppleHealthDailySampleInput): ProviderRawRecord {
  return {
    dataType: 'OTHER',
    // Deterministic per day, scoped by the connection's own id at the
    // storage layer — re-pushing the same day's summary (e.g. a background
    // resync overlapping a manual "sync now") upserts instead of
    // duplicating, exactly like Oura's own per-day record ids do.
    externalId: `daily-summary-${sample.date}`,
    dataDate: new Date(sample.date),
    payload: sample,
  };
}

/**
 * The payload IS already the normalized shape (see module comment) — this
 * only re-validates the dataType tag and passes the fields through
 * unchanged, no unit conversion or field renaming needed.
 */
export function mapAppleHealthRecordToDailyMetric(record: ProviderRawRecord): NormalizedDailyMetric | null {
  if (record.dataType !== 'OTHER') {
    return null;
  }
  const payload = record.payload as AppleHealthDailySampleInput;
  return {
    date: record.dataDate,
    fields: {
      steps: payload.steps,
      activeCalories: payload.activeCalories,
      totalCalories: payload.totalCalories,
      restingHeartRate: payload.restingHeartRate,
      averageHrv: payload.averageHrv,
      totalSleepMinutes: payload.totalSleepMinutes,
      deepSleepMinutes: payload.deepSleepMinutes,
      remSleepMinutes: payload.remSleepMinutes,
      lightSleepMinutes: payload.lightSleepMinutes,
      awakeMinutes: payload.awakeMinutes,
      sleepEfficiencyPct: payload.sleepEfficiencyPct,
      bedtimeStart: payload.bedtimeStart,
      bedtimeEnd: payload.bedtimeEnd,
    },
  };
}
