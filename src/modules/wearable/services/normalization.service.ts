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
  // Narrowed from the full WearableProviderAdapter (this function only ever
  // calls mapToNormalizedFields) so phase 19's Apple Health ingestion route
  // can pass a plain `{ mapToNormalizedFields }` object instead of a full
  // OAuth-shaped adapter — Apple Health has no token exchange/refresh/revoke
  // to implement (the device pushes data directly, there's no cloud API to
  // pull from). Every existing caller (Oura's full adapter) is still
  // trivially assignable here — this is a type-only narrowing, zero
  // behavior change for the existing sync path.
  adapter: Pick<WearableProviderAdapter, 'mapToNormalizedFields'>;
}): Promise<{ datesUpserted: number }> {
  // TEMPORARY, DELIBERATE diagnostic — one line per call (not per record), so
  // this is safe from the log-rate-limit regression that per-record logging
  // caused earlier. Added to confirm this function is actually being entered
  // (and see how large its record batch is) at the exact point the sync
  // write path has repeatedly frozen, right after storeRawRecords finishes.
  // eslint-disable-next-line no-console -- deliberate, bounded diagnostic output
  console.error(`[db] normalizeAndUpsertDailyMetrics: entered with ${params.records.length} records for userId=${params.userId}`);

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
    // TEMPORARY, DELIBERATE diagnostic — pool.connect() itself has now been
    // proven fast (0-24ms) on two separate live sync attempts under this
    // exact deployment, yet both attempts still froze somewhere after that,
    // with the sync_jobs row stuck in RUNNING and zero pg_stat_activity rows
    // for minutes afterward. Nothing has ever logged what happens *inside*
    // this loop before now, so it's entirely possible the freeze is on one
    // specific date's query() call, not on entry or on connect(). Bounded:
    // at most one pair of lines per distinct date in this sync window
    // (single digits to low tens in practice), never per raw record.
    const totalDates = fieldsByDateKey.size;
    let dateIndex = 0;
    for (const { date, fields } of fieldsByDateKey.values()) {
      dateIndex += 1;
      const presentColumns = DAILY_METRIC_COLUMNS.filter((column) => fields[column] !== undefined);
      const dynamicValues = presentColumns.map((column) => fields[column]);
      const dynamicPlaceholders = presentColumns.map((column, i) => {
        const placeholder = `$${5 + i}`;
        return TIMESTAMP_COLUMNS.has(column) ? `${placeholder}::timestamp` : placeholder;
      });
      const insertColumnsSql = presentColumns.map((column) => `"${column}"`).join(', ');
      const updateSetSql = presentColumns.map((column) => `"${column}" = excluded."${column}"`).join(', ');

      const dateT0 = Date.now();
      // eslint-disable-next-line no-console -- deliberate, bounded diagnostic output (see comment above)
      console.error(`[db] normalizeAndUpsertDailyMetrics ${params.userId}: upserting date ${dateIndex}/${totalDates} (${date.toISOString().slice(0, 10)})`);

      // TEMPORARY, DELIBERATE diagnostic — every prior diagnostic bracketed
      // this query() call from the outside (before/after) and always showed
      // the exact same result: the "before" line above logs fine, the
      // "after" line (below) never does, no matter what's been rewritten in
      // the surrounding pool/connection code. That points at the *value*
      // being sent, not the mechanics of sending it. bedtimeStart/bedtimeEnd
      // are the only two columns in this insert built from `new Date(...)`
      // (oura-mappers.ts's DAILY_SLEEP case) rather than a plain number, and
      // an Oura payload missing bedtime_start/bedtime_end (confirmed present
      // in this exact user's raw DAILY_SLEEP data for one specific date)
      // silently produces a JS Invalid Date, not a thrown error. Logging
      // each dynamic value's type/validity here, in a try/catch so this
      // diagnostic itself can never crash the loop, is a single bounded line
      // per date -- the same safety guarantee as every other diagnostic in
      // this file.
      try {
        const valueReport = presentColumns
          .map((column, i) => {
            const value = dynamicValues[i];
            if (value instanceof Date) {
              return `${column}=Date(${Number.isNaN(value.getTime()) ? 'INVALID' : value.toISOString()})`;
            }
            if (typeof value === 'number' && Number.isNaN(value)) {
              return `${column}=NaN`;
            }
            return `${column}=${JSON.stringify(value)}`;
          })
          .join(', ');
        // eslint-disable-next-line no-console -- deliberate, bounded diagnostic output
        console.error(`[db] normalizeAndUpsertDailyMetrics ${params.userId}: date ${dateIndex}/${totalDates} values: ${valueReport}`);
      } catch (reportError) {
        // eslint-disable-next-line no-console -- deliberate, bounded diagnostic output
        console.error(`[db] normalizeAndUpsertDailyMetrics ${params.userId}: date ${dateIndex}/${totalDates} value report itself failed: ${(reportError as Error).message}`);
      }

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

      // eslint-disable-next-line no-console -- deliberate, bounded diagnostic output
      console.error(`[db] normalizeAndUpsertDailyMetrics ${params.userId}: date ${dateIndex}/${totalDates} done in ${Date.now() - dateT0}ms`);
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
    // TEMPORARY, DELIBERATE diagnostic — same rationale as the per-date log
    // in normalizeAndUpsertDailyMetrics above: bounded to one pair of lines
    // per workout in this sync window (never per raw record).
    const totalWorkouts = workouts.length;
    let workoutIndex = 0;
    for (const workout of workouts) {
      workoutIndex += 1;
      const workoutT0 = Date.now();
      // eslint-disable-next-line no-console -- deliberate, bounded diagnostic output
      console.error(`[db] normalizeAndUpsertWorkouts ${params.userId}: upserting workout ${workoutIndex}/${totalWorkouts} (${workout.externalId})`);

      // TEMPORARY, DELIBERATE diagnostic — same rationale as
      // normalizeAndUpsertDailyMetrics's per-date value report: after the
      // DAILY_SLEEP Invalid Date/NaN fix, a live sync got past every date
      // for the first time ever, then froze again at this exact point --
      // "upserting workout 1/48" logs, the query() call after it never
      // completes, and pg_stat_activity shows no trace of the app (the same
      // signature as every earlier freeze in this investigation, on data
      // that turned out this time to look well-formed except for
      // `calories` being a non-integer float going into an `integer`
      // column). Reporting every dynamic value here, in the same
      // try/catch-guarded, one-line-per-workout shape as the dates
      // diagnostic, in case something else is still hiding in this record.
      try {
        const workoutValueReport = [
          `startedAt=Date(${Number.isNaN(workout.startedAt.getTime()) ? 'INVALID' : workout.startedAt.toISOString()})`,
          `endedAt=Date(${Number.isNaN(workout.endedAt.getTime()) ? 'INVALID' : workout.endedAt.toISOString()})`,
          `durationMin=${Number.isNaN(workout.durationMin) ? 'NaN' : workout.durationMin}`,
          `calories=${workout.calories === undefined ? 'undefined' : Number.isNaN(workout.calories) ? 'NaN' : workout.calories}`,
          `distanceM=${workout.distanceM === undefined ? 'undefined' : Number.isNaN(workout.distanceM) ? 'NaN' : workout.distanceM}`,
          `intensity=${JSON.stringify(workout.intensity)}`,
          `activityType=${JSON.stringify(workout.activityType)}`,
        ].join(', ');
        // eslint-disable-next-line no-console -- deliberate, bounded diagnostic output
        console.error(`[db] normalizeAndUpsertWorkouts ${params.userId}: workout ${workoutIndex}/${totalWorkouts} values: ${workoutValueReport}`);
      } catch (reportError) {
        // eslint-disable-next-line no-console -- deliberate, bounded diagnostic output
        console.error(`[db] normalizeAndUpsertWorkouts ${params.userId}: workout ${workoutIndex}/${totalWorkouts} value report itself failed: ${(reportError as Error).message}`);
      }

      // eslint-disable-next-line no-await-in-loop -- same rationale as normalizeAndUpsertDailyMetrics: small batch, sequential, single checked-out client
      await query(
        `insert into workouts
           (id, "userId", provider, "externalId", "activityType", "startedAt", "endedAt", "durationMin", calories, "distanceM", intensity, source, "updatedAt")
         values ($1, $2, $3::"WearableProvider", $4, $5, $6::timestamp, $7::timestamp, $8, $9, $10, $11, $12, now())
         on conflict (provider, "externalId") do update set
           "activityType" = excluded."activityType",
           "startedAt" = excluded."startedAt",
           "endedAt" = excluded."endedAt",
           "durationMin" = excluded."durationMin",
           calories = excluded.calories,
           "distanceM" = excluded."distanceM",
           intensity = excluded.intensity,
           source = excluded.source,
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
          workout.source ?? null,
        ],
      );

      // eslint-disable-next-line no-console -- deliberate, bounded diagnostic output
      console.error(`[db] normalizeAndUpsertWorkouts ${params.userId}: workout ${workoutIndex}/${totalWorkouts} done in ${Date.now() - workoutT0}ms`);
    }

    return { workoutsUpserted: workouts.length };
  });
}
