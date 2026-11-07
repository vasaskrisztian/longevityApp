import { ingestHealthConnect, type HealthConnectIngestResult } from '@/src/api/healthConnect';
import { addDays } from './aggregate';
import native from './healthConnectNative';
import type { HealthConnectAvailability } from './healthConnectTypes';
import { syncWindowDays } from './sync';

const MAX_SAMPLES_PER_REQUEST = 180;

export type HealthConnectSyncOutcome =
  | { status: 'unsupported' }
  | { status: 'unavailable'; availability: HealthConnectAvailability }
  | { status: 'no_permission' }
  | { status: 'no_data' }
  | { status: 'synced'; days: number; result: HealthConnectIngestResult };

/**
 * Reads the daily summaries from Health Connect and uploads them, mirror of
 * syncAppleHealth.
 *
 *  - `interactive: true` (the person tapped Connect / Sync now): shows the
 *    Health Connect permission screen first (it may also ask for background and
 *    history access). Needs the app in the foreground.
 *  - `interactive: false` (automatic sync on app open, background job): never
 *    shows anything — if access is not granted it stops with `no_permission`.
 *
 * `lastSyncAt` comes from the server's connection summary and decides how far
 * back to read (a 90-day backfill the first time, then from the last sync).
 */
export async function syncHealthConnect(
  lastSyncAt: string | null | undefined,
  options: { interactive?: boolean; now?: Date } = {},
): Promise<HealthConnectSyncOutcome> {
  const now = options.now ?? new Date();
  const availability = await native.availability();
  if (availability === 'unsupported') return { status: 'unsupported' };
  if (availability !== 'available') return { status: 'unavailable', availability };

  const access = options.interactive ? await native.requestAccess() : await native.getAccess();
  if (!access.granted) return { status: 'no_permission' };

  const from = addDays(now, -(syncWindowDays(lastSyncAt, now) - 1));
  const samples = await native.readDailySummaries(from, now);
  if (samples.length === 0) return { status: 'no_data' };

  let last: HealthConnectIngestResult | null = null;
  for (let i = 0; i < samples.length; i += MAX_SAMPLES_PER_REQUEST) {
    last = await ingestHealthConnect(samples.slice(i, i + MAX_SAMPLES_PER_REQUEST));
  }
  return { status: 'synced', days: samples.length, result: last as HealthConnectIngestResult };
}
