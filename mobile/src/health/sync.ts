import { ingestAppleHealth, type AppleHealthIngestResult } from '@/src/api/appleHealth';
import { addDays } from './aggregate';
import native from './native';

/** First connect: pull this many days of history (backend accepts up to 180 per request). */
export const BACKFILL_DAYS = 90;
/** Routine sync window — overlapping days are fine, the backend upserts per day. */
export const RECENT_DAYS = 7;
const MAX_SAMPLES_PER_REQUEST = 180;

export type AppleHealthSyncOutcome =
  | { status: 'unsupported' }
  | { status: 'no_data' }
  | { status: 'synced'; days: number; result: AppleHealthIngestResult };

/**
 * How far back to read: a full backfill when this account has never synced
 * Apple Health, otherwise from the last sync (at least RECENT_DAYS, at most
 * BACKFILL_DAYS).
 */
export function syncWindowDays(lastSyncAt: string | null | undefined, now: Date = new Date()): number {
  if (!lastSyncAt) return BACKFILL_DAYS;
  const last = new Date(lastSyncAt);
  if (Number.isNaN(last.getTime())) return BACKFILL_DAYS;
  const elapsedDays = Math.ceil((now.getTime() - last.getTime()) / 86_400_000) + 1;
  return Math.min(BACKFILL_DAYS, Math.max(RECENT_DAYS, elapsedDays));
}

/**
 * Asks for HealthKit access (safe to repeat: iOS only shows the sheet for
 * types it has not asked about yet), reads the daily summaries for the window
 * and uploads them. `lastSyncAt` comes from the server's connection summary.
 */
export async function syncAppleHealth(
  lastSyncAt: string | null | undefined,
  now: Date = new Date(),
): Promise<AppleHealthSyncOutcome> {
  if (!(await native.isSupported())) return { status: 'unsupported' };
  await native.requestAccess();

  const from = addDays(now, -(syncWindowDays(lastSyncAt, now) - 1));
  const samples = await native.readDailySummaries(from, now);
  if (samples.length === 0) return { status: 'no_data' };

  let last: AppleHealthIngestResult | null = null;
  for (let i = 0; i < samples.length; i += MAX_SAMPLES_PER_REQUEST) {
    last = await ingestAppleHealth(samples.slice(i, i + MAX_SAMPLES_PER_REQUEST));
  }
  return { status: 'synced', days: samples.length, result: last as AppleHealthIngestResult };
}
