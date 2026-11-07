import type { NormalizedDailyMetric, ProviderRawRecord } from '../../domain/wearable-provider.types';
import {
  appleHealthSampleToRawRecord,
  mapAppleHealthRecordToDailyMetric,
} from '../apple-health/apple-health-mapper';

/**
 * Health Connect sends the same already-normalized per-day summary as Apple
 * Health (see lib/validation/health-connect.schemas.ts), so the raw-record and
 * daily-metric mapping is identical — these wrappers only give the provider
 * its own named entry points (and let the two diverge later without touching
 * the Apple Health code). Idempotency is the same: one raw record per day,
 * keyed by `daily-summary-<date>` inside the provider's own connection.
 */
export const healthConnectSampleToRawRecord = appleHealthSampleToRawRecord;

export function mapHealthConnectRecordToDailyMetric(record: ProviderRawRecord): NormalizedDailyMetric | null {
  return mapAppleHealthRecordToDailyMetric(record);
}
