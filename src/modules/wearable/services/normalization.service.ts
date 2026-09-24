import { randomUUID } from 'node:crypto';
import { dbPool } from '@/lib/db/prisma';
import { runQuery } from '@/lib/db/run-query';
import type {
  NormalizedDailyMetricFields,
  ProviderRawRecord,
  WearableProviderAdapter,
  WearableProviderId,
} from '../domain/wearable-provider.types';

/**
 * Merges every raw record's contribution into per-date field sets (a sleep
 * record and an activity record for the same day both land in the same
 * DailyHealthMetric row), then upserts one row per date —
 * `DailyHealthMetric` is unique on `(userId, date)` (ARCHITECTURE.md §7.6).
 * Only `adapter.mapToNormalizedFields` ever interprets a raw payload; this
 * function stays completely provider-agnostic.
 *
 * THIS USED TO GO THROUGH PRISMA CLIENT (`prisma.dailyHealthMetric.findUnique`
 * + `.upsert`) — that turned out to be exactly where the sync write path's
 * long-standing "hang" was actually hiding. Every earlier fix in this
 * investigation focused on storeRawRecords (raw-record.service.ts), because
 * the last stage log seen before a hang was always `db_write_start`, which
 * fires once, before ALL THREE of storeRawRecords / normalizeAndUpsertDailyMetrics
 * / normalizeAndUpsertWorkouts run — nothing distinguished which of the
 * three had actually frozen. Once storeRawRecords was proven fast and
 * reliable (a live sync completed its raw-record writes in ~1s for 465
 * records) but the job still sat in RUNNING with zero further progress and
 * zero rows in pg_stat_activity, the freeze was finally isolated to here:
 * the very first Prisma Client call after a large batch of raw `dbPool`
 * activity. Moved to hand-written SQL through `dbPool` (the same pool and
 * pattern storeRawRecords already uses successfully), eliminating Prisma
 * Client from the sync write path entirely. This also removes the
 * separate `findUnique` read that used to precede every upsert — the
 * merge of `sourceProviders` is now done in SQL (`ARRAY(SELECT DISTINCT
 * unnest(...))`), so each date is one query instead of two.
 */

// NormalizedDailyMetricFields' keys map 1:1 onto DailyHealthMetric's own
// (non-relational, non-audit) columns — same names, no @map on any of them.
const DAILY_METRIC_COLUMNS = [
  'sleepScore',
  'readinessScore',
  'activityScore',
  'totalSleepMinutes',
  'deepSleepMinutes',
  'remSleepMinutes',
  'lightSleepMinutes',
  'awakeMinutes',
  'sleepEfficiencyPct',
  'sleepLatencyMinutes',
  'bedtimeStart',
  'bedtimeEnd',
  'restingHeartRate',
  'averageHrv',
  'temperatureDeviationC',
  'steps',
  'activeCalories',
  'totalCalories',
  'walkingEquivalentMin',
  'sedentaryMinutes',
  'spo2Average',
] as const satisfies readonly (keyof NormalizedDailyMetricFields)[];

// bedtimeStart/bedtimeEnd are timestamps; every other column here is a
// plain int or decimal that `pg` parses correctly from a JS number without
// an explicit cast.
const TIMESTAMP_COLUMNS = new Set<string>(['bedtimeStart', 'bedtimeEnd']);

export async function normalizeAndUpsertDailyMetrics(params: {
  userId: string;
  provider: WearableProviderId;
  records: ProviderRawRecord[];
  adapter: WearableProviderAdapter;
}): Promise<{ datesUpserted: number }> {
  // Diagnostic only, temporary: proves whether execution reaches this
  // function at all right after storeRawRecords resolves, before the
  // (synchronous, should-be-instant) mapping loop below runs. See
  // run-query.ts's matching "calling pool.connect()" line -- between the
  // two, the next live sync will show exactly which side of that boundary
  // the freeze is on.
  // eslint-disable-next-line no-console -- deliberate, bounded diagnostic output
  console.error(`[db] normalizeAndUpsertDailyMetrics entry: recordCount=${params.records.length}`);
  const fieldsByDateKey = new Map<string, { date: Date; fields: NormalizedDailyMetricFields }>();

  for (const record of params.records) {
    const mapped = params.adapter.mapToNormalizedFields(record);
    if (!mapped) {
      continue;
    }
    const dateKey = mapped.date.toISOString().slice(0, 10);
    const existingEntry = fieldsByDateKey.get(dateKey);
    fieldsByDateKey.set(dateKey, {
      date: mapped.date,
      fields: { ...(existingEntry?.fields ?? {}), ...mapped.fields },
    });
  }

  for (const { date, fields } of fieldsByDateKey.values()) {
    const presentColumns = DAILY_METRIC_COLUMNS.filter((column) => fields[column] !== undefined);
    const dynamicValues = presentColumns.map((column) => fields[column]);
    const dynamicPlaceholders = presentColumns.map((column, i) => {
      const placeholder = `$${5 + i}`;
      return TIMESTAMP_COLUMNS.has(column) ? `${placeholder}::timestamp` : placeholder;
    });
    const insertColumnsSql = presentColumns.map((column) => `"${column}"`).join(', ');
    const updateSetSql = presentColumns.map((column) => `"${column}" = excluded."${column}"`).join(', ');

    // eslint-disable-next-line no-await-in-loop -- one upsert per distinct date in this batch (at most the number of days in the sync window); no benefit to parallelizing writes to the same table
    await runQuery(
      dbPool,
      `dailyMetric ${date.toISOString().slice(0, 10)}`,
      `insert into daily_health_metrics
         (id, "userId", date, "sourceProviders"${presentColumns.length ? `, ${insertColumnsSql}` : ''}, "updatedAt")
       values
         ($1, $2, $3::date, $4::"WearableProvider"[]${presentColumns.length ? `, ${dynamicPlaceholders.join(', ')}` : ''}, now())
       on conflict ("userId", date) do update set
         "sourceProviders" = ARRAY(
           select distinct unnest(daily_health_metrics."sourceProviders" || excluded."sourceProviders")
         )${presentColumns.length ? `, ${updateSetSql}` : ''},
         "updatedAt" = now()`,
      [randomUUID(), params.userId, date, [params.provider], ...dynamicValues],
    );
  }

  return { datesUpserted: fieldsByDateKey.size };
}

/** `Workout` is unique on `(provider, externalId)` (ARCHITECTURE.md §7.6). */
export async function normalizeAndUpsertWorkouts(params: {
  userId: string;
  provider: WearableProviderId;
  records: ProviderRawRecord[];
  adapter: WearableProviderAdapter;
}): Promise<{ workoutsUpserted: number }> {
  let workoutsUpserted = 0;

  for (const record of params.records) {
    const workout = params.adapter.mapToWorkout(record);
    if (!workout) {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop -- same rationale as normalizeAndUpsertDailyMetrics: small batch, sequential for simplicity
    await runQuery(
      dbPool,
      `workout ${workout.externalId}`,
      `insert into workouts
         (id, "userId", provider, "externalId", "activityType", "startedAt", "endedAt", "durationMin", calories, "distanceM", intensity, "updatedAt")
       values ($1, $2, $3::"WearableProvider", $4, $5, $6::timestamp, $7::timestamp, $8, $9, $10, $11, now())
       on conflict (provider, "externalId") do update set
         "activityType" = excluded."activityType",
         "startedAt" = excluded."startedAt",
         "endedAt" = excluded."endedAt",
         "durationMin" = excluded."durationMin",
         calories = excluded.calories,
         "distanceM" = excluded."distanceM",
         intensity = excluded.intensity,
         "updatedAt" = now()`,
      [
        randomUUID(),
        params.userId,
        params.provider,
        workout.externalId,
        workout.activityType,
        workout.startedAt,
        workout.endedAt,
        workout.durationMin,
        workout.calories ?? null,
        workout.distanceM ?? null,
        workout.intensity ?? null,
      ],
    );
    workoutsUpserted += 1;
  }

  return { workoutsUpserted };
}
