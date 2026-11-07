import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { checkRateLimit, HEALTH_CONNECT_INGEST_RATE_LIMIT } from '@/lib/auth/rate-limit';
import { HealthConnectIngestSchema } from '@/lib/validation/health-connect.schemas';
import { upsertConnectionAsConnected, recordSyncOutcome } from '@/modules/wearable/services/wearable.service';
import { storeRawRecords } from '@/modules/wearable/services/raw-record.service';
import { normalizeAndUpsertDailyMetrics } from '@/modules/wearable/services/normalization.service';
import {
  healthConnectSampleToRawRecord,
  mapHealthConnectRecordToDailyMetric,
} from '@/modules/wearable/providers/health-connect/health-connect-mapper';

/**
 * Android Health Connect — a PUSH endpoint, exactly like
 * /api/integrations/apple-health/ingest (read its header comment for the full
 * design): Health Connect data only exists on the phone, so the Android app
 * reads it, aggregates it into one summary per local day (steps, calories,
 * resting heart rate, HRV, sleep) and POSTs a batch here. The connection is
 * marked CONNECTED the first time a push succeeds, and `lastSyncAt` is what
 * the Devices screen (mobile and web) shows as "last sync".
 *
 * Samsung Health, Google Fit's successors and other Android sources write into
 * Health Connect on the phone; Huawei Health does not, so it needs a bridge
 * app on the phone to appear here.
 *
 * Uses the same raw-record -> daily-metric write path as Oura and Apple Health
 * (retrying the same push twice upserts, never duplicates).
 */
export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const rateLimit = checkRateLimit('health-connect-ingest', userId, HEALTH_CONNECT_INGEST_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Too many Health Connect sync requests. Please try again in a minute.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = HealthConnectIngestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Health Connect's own on-device permission sheet gates which data types the
  // app can read; there is no OAuth scope list for the backend to record.
  const { id: connectionId } = await upsertConnectionAsConnected({
    userId,
    provider: 'HEALTH_CONNECT',
    grantedScopes: [],
  });

  const records = parsed.data.samples.map(healthConnectSampleToRawRecord);

  const { created, updated } = await storeRawRecords({
    userId,
    connectionId,
    provider: 'HEALTH_CONNECT',
    records,
  });

  const { datesUpserted } = await normalizeAndUpsertDailyMetrics({
    userId,
    provider: 'HEALTH_CONNECT',
    records,
    adapter: { mapToNormalizedFields: mapHealthConnectRecordToDailyMetric },
  });

  await recordSyncOutcome(connectionId, 'SUCCESS');

  return Response.json(
    { connectionId, recordsCreated: created, recordsUpdated: updated, datesUpserted },
    { status: 200 },
  );
}
