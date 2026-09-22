import { prisma } from '@/lib/db/prisma';
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
 */
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

  for (const { date, fields } of fieldsByDateKey.values()) {
    // eslint-disable-next-line no-await-in-loop -- one upsert per distinct date in this batch (at most the number of days in the sync window); no benefit to parallelizing writes to the same table
    const existingRow = await prisma.dailyHealthMetric.findUnique({
      where: { userId_date: { userId: params.userId, date } },
      select: { sourceProviders: true },
    });
    const sourceProviders = new Set<WearableProviderId>(existingRow?.sourceProviders ?? []);
    sourceProviders.add(params.provider);

    // eslint-disable-next-line no-await-in-loop
    await prisma.dailyHealthMetric.upsert({
      where: { userId_date: { userId: params.userId, date } },
      create: {
        userId: params.userId,
        date,
        ...fields,
        sourceProviders: Array.from(sourceProviders),
      },
      update: {
        ...fields,
        sourceProviders: Array.from(sourceProviders),
      },
    });
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
    await prisma.workout.upsert({
      where: { provider_externalId: { provider: params.provider, externalId: workout.externalId } },
      create: {
        userId: params.userId,
        provider: params.provider,
        externalId: workout.externalId,
        activityType: workout.activityType,
        startedAt: workout.startedAt,
        endedAt: workout.endedAt,
        durationMin: workout.durationMin,
        calories: workout.calories,
        distanceM: workout.distanceM,
        intensity: workout.intensity,
      },
      update: {
        activityType: workout.activityType,
        startedAt: workout.startedAt,
        endedAt: workout.endedAt,
        durationMin: workout.durationMin,
        calories: workout.calories,
        distanceM: workout.distanceM,
        intensity: workout.intensity,
      },
    });
    workoutsUpserted += 1;
  }

  return { workoutsUpserted };
}
