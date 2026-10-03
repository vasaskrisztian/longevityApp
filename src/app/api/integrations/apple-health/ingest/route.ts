import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { checkRateLimit, APPLE_HEALTH_INGEST_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { AppleHealthIngestSchema } from '@/lib/validation/apple-health.schemas';
import { upsertConnectionAsConnected, recordSyncOutcome } from '@/modules/wearable/services/wearable.service';
import { storeRawRecords } from '@/modules/wearable/services/raw-record.service';
import { normalizeAndUpsertDailyMetrics } from '@/modules/wearable/services/normalization.service';
import {
  appleHealthSampleToRawRecord,
  mapAppleHealthRecordToDailyMetric,
} from '@/modules/wearable/providers/apple-health/apple-health-mapper';

/**
 * Apple Health has no cloud API to pull from (HealthKit data only exists on
 * the device) — see claude/phase-15-mobile-migration-plan.md's phase 19
 * notes. So unlike every GET /api/integrations/oura/* route, this is a PUSH
 * endpoint: the mobile app itself queries HealthKit, aggregates the result
 * into one AppleHealthDailySampleSchema-shaped summary per day, and POSTs a
 * batch here. There is no OAuth to exchange and therefore no
 * WearableProviderAdapter to implement for this provider — the connection
 * is simply marked CONNECTED the first time a push succeeds, exactly like
 * saying "yes, this device is actively sending us data" rather than "we
 * hold a credential that lets us go fetch data on demand".
 *
 * Reuses the same storeRawRecords -> normalizeAndUpsertDailyMetrics write
 * path Oura's sync.service.ts uses (modules/wearable/services/
 * normalization.service.ts's adapter param was narrowed to
 * Pick<WearableProviderAdapter, 'mapToNormalizedFields'> specifically so
 * this route can pass a plain object instead of a full OAuth-shaped
 * adapter) — this inherits that path's hard-won idempotency and
 * single-client-per-call behavior (see that file's own comments) rather
 * than reimplementing the upsert SQL a second time.
 *
 * Deliberately NOT wired through SyncJob/the BullMQ queue (ARCHITECTURE.md
 * §7.5's orchestration) — there's no external round-trip to run in the
 * background here; the whole point is that the device already has the
 * data in hand, so the write happens synchronously in the request and the
 * response reports exactly what was written. recordSyncOutcome is reused
 * anyway, purely so "last synced" has a real answer once a Devices screen
 * surfaces it for this provider too.
 */
export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const rateLimit = checkRateLimit('apple-health-ingest', userId, APPLE_HEALTH_INGEST_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Too many Apple Health sync requests. Please try again in a minute.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = AppleHealthIngestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // No grantedScopes concept for a push-only provider — HealthKit's own
  // on-device permission sheet is what actually gates which data types the
  // app could read before aggregating, not an OAuth scope list the backend
  // would have any visibility into.
  const { id: connectionId } = await upsertConnectionAsConnected({
    userId,
    provider: 'APPLE_HEALTH',
    grantedScopes: [],
  });

  const records = parsed.data.samples.map(appleHealthSampleToRawRecord);

  const { created, updated } = await storeRawRecords({
    userId,
    connectionId,
    provider: 'APPLE_HEALTH',
    records,
  });

  const { datesUpserted } = await normalizeAndUpsertDailyMetrics({
    userId,
    provider: 'APPLE_HEALTH',
    records,
    adapter: { mapToNormalizedFields: mapAppleHealthRecordToDailyMetric },
  });

  await recordSyncOutcome(connectionId, 'SUCCESS');

  return Response.json(
    { connectionId, recordsCreated: created, recordsUpdated: updated, datesUpserted },
    { status: 200 },
  );
}
