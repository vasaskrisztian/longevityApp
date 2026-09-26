import { randomUUID } from 'node:crypto';
import { dbPool } from '@/lib/db/prisma';
import { withClient } from '@/lib/db/run-query';
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
 * + `.upsert`) — that was fixed by moving to hand-written SQL, but the sync
 * write path KEPT hanging even after that, at the exact same point (right
 * after storeRawRecords, before this function's first query). The real,
 * final root cause: this function and storeRawRecords used to each do a
 * separate connect()+query()+release() cycle PER ROW/RECORD against the
 * same shared `dbPool` — reproduced live on two consecutive scheduled runs
 * (2026-09-25 and 2026-09-26), storeRawRecords always finishing its ~2200
 * cycles cleanly, then THIS function's very first `pool.connect()` call
 * hanging forever, even though the pool reported its one client as idle
 * and immediately available right before the call. See run-query.ts's top
 * comment for the full writeup. Fixed by checking out exactly ONE client
 * for this whole function call via `withClient` and reusing it for every
 * date's upsert, instead of one checkout per date.
 *
 * This also removes the separate `findUnique` read that used to precede
 * every upsert — the merge of `sourceProviders` is done in SQL (`ARRAY
 * (SELECT DISTINCT unnest(...))`), so each date is one query instead of two.
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

  if (fieldsByDateKey.size === 0) {
    return { datesUpserted: 0 };
  }

  return withClient(dbPool, `normalizeAndUpsertDailyMetrics ${params.userId}`, async (query) => {
    for (const { date, fields } of fieldsByDateKey.values()) {
      const presentColumns = DAILY_METRIC_COLUMNS.filter((column) => fields[column] !== undefined);
      const dynamicValues = presentColumns.map((column) => fields[column]);
      const dynamicPlaceholders = presentColumns.map((column, i) => {
        const placeholder = `$${5 + i}`;
        return TIMESTAMP_COLUMNS.has(column) ? `${placeholder}::timestamp` : placeholder;
      });
      const insertColumnsSql = presentColumns.map((column) => `"${column}"`).join(', ');
      const updateSetSql = presentColumns.map((column) => `"${column}" = excluded."${column}"`).join(', ');

      // eslint-disable-next-line no-await-in-loop -- one upsert per distinct date in this batch (at most the number of days in the sync window), against the single client checked out above; no benefit to parallelizing writes to the same table
      await query(
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
  });
}

/** `Workout` is unique on `(provider, externalId)` (ARCHITECTURE.md §7.6). */
export async function normalizeAndUpsertWorkouts(params: {
  userId: string;
  provider: WearableProviderId;
  records: ProviderRawRecord[];
  adapter: WearableProviderAdapter;
}): Promise<{ workoutsUpserted: number }> {
  const workouts = params.records
    .map((record) => params.adapter.mapToWorkout(record))
    .filter((workout): workout is NonNullable<typeof workout> => workout !== null);

  if (workouts.length === 0) {
    return { workoutsUpserted: 0 };
  }

  return withClient(dbPool, `normalizeAndUpsertWorkouts ${params.userId}`, async (query) => {
    for (const workout of workouts) {
      // eslint-disable-next-line no-await-in-loop -- same rationale as normalizeAndUpsertDailyMetrics: small batch, sequential, single checked-out client
      await query(
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
    }

    return { workoutsUpserted: workouts.length };
  });
}
