import { apiFetch } from '@/src/api/client';
import type { AppleHealthDailySample } from '@/src/health/aggregate';

export interface AppleHealthIngestResult {
  connectionId: string;
  recordsCreated: number;
  recordsUpdated: number;
  datesUpserted: number;
}

/**
 * POST /api/integrations/apple-health/ingest — the backend caps a request at
 * 180 daily samples; callers chunk accordingly (see health/sync.ts). 429 means
 * the per-user ingest rate limit was hit.
 */
export async function ingestAppleHealth(samples: AppleHealthDailySample[]): Promise<AppleHealthIngestResult> {
  const response = await apiFetch('/api/integrations/apple-health/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ samples }),
  });
  if (response.status === 429) {
    throw new AppleHealthRateLimitedError();
  }
  if (!response.ok) {
    throw new Error(`Apple Health upload failed (${response.status}).`);
  }
  return (await response.json()) as AppleHealthIngestResult;
}

export class AppleHealthRateLimitedError extends Error {
  constructor() {
    super('Too many Apple Health sync requests. Please try again in a minute.');
    this.name = 'AppleHealthRateLimitedError';
  }
}
