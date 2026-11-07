import { apiFetch } from '@/src/api/client';
import { t } from '@/src/i18n';
import type { AppleHealthDailySample } from '@/src/health/aggregate';

export interface HealthConnectIngestResult {
  connectionId: string;
  recordsCreated: number;
  recordsUpdated: number;
  datesUpserted: number;
}

/**
 * POST /api/integrations/health-connect/ingest — the Android twin of the Apple
 * Health upload (same daily-summary shape, up to 180 days per request; callers
 * chunk, see health/healthConnectSync.ts). 429 means the per-user ingest rate
 * limit was hit.
 */
export async function ingestHealthConnect(samples: AppleHealthDailySample[]): Promise<HealthConnectIngestResult> {
  const response = await apiFetch('/api/integrations/health-connect/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ samples }),
  });
  if (response.status === 429) {
    throw new HealthConnectRateLimitedError();
  }
  if (!response.ok) {
    throw new Error(`Health Connect upload failed (${response.status}).`);
  }
  return (await response.json()) as HealthConnectIngestResult;
}

export class HealthConnectRateLimitedError extends Error {
  constructor() {
    // Shown to the person as is, so it is translated when the error is created.
    super(t('health.hc.rateLimited'));
    this.name = 'HealthConnectRateLimitedError';
  }
}
