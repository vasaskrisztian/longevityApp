import { logger } from '@/lib/logging/logger';
import type {
  OuraDailyActivityRecord,
  OuraDailyReadinessRecord,
  OuraDailySleepRecord,
  OuraDailySpo2Record,
  OuraHeartRateRecord,
  OuraWorkoutRecord,
} from './oura-data-types';

/**
 * The real (non-mock) Oura v2 `usercollection` API client. Every endpoint is
 * cursor-paginated (`next_token`); `fetchOuraCollection` walks every page
 * before returning, so callers (oura-provider.ts) never see a partial page.
 * A network/HTTP failure on one endpoint throws — the caller
 * (`OuraProvider.fetchRawData`) runs all six endpoints independently via
 * `Promise.allSettled` so one endpoint's failure never discards data another
 * endpoint successfully returned.
 */

const OURA_API_BASE = 'https://api.ouraring.com/v2/usercollection';

// A plain `fetch()` has no default timeout — if Oura's API (or the network
// path to it) ever stalls instead of erroring, an unbounded `await fetch(...)`
// hangs forever, which BullMQ has no way to notice: the SyncJob row sits at
// RUNNING permanently, the connection's lastSyncStatus is never updated (that
// only happens once runSyncForConnection returns), and the queue's single
// concurrency slot for that job type is wedged, silently blocking every sync
// after it too. Bounding every request lets a stall surface as an ordinary
// per-endpoint failure instead — `OuraProvider.fetchRawData`'s
// `Promise.allSettled` already treats that exactly like an HTTP error (see
// its class doc), and `sync-retry-policy.ts` retries it with backoff like any
// other transient failure.
const REQUEST_TIMEOUT_MS = 20_000;

interface OuraCollectionPage<T> {
  data: T[];
  next_token: string | null;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function fetchOuraCollection<T>(params: {
  endpoint: string;
  accessToken: string;
  from: Date;
  to: Date;
}): Promise<T[]> {
  const results: T[] = [];
  let nextToken: string | undefined;
  let page = 0;

  do {
    page += 1;
    const url = new URL(`${OURA_API_BASE}/${params.endpoint}`);
    url.searchParams.set('start_date', toDateOnly(params.from));
    url.searchParams.set('end_date', toDateOnly(params.to));
    if (nextToken) {
      url.searchParams.set('next_token', nextToken);
    }

    const pageStart = Date.now();
    logger.info('sync_job_stage', { stage: 'oura_page_fetch_start', endpoint: params.endpoint, page });

    // eslint-disable-next-line no-await-in-loop -- pagination is inherently sequential (each page's next_token depends on the previous response)
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${params.accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((error: unknown) => {
      logger.warn('sync_job_stage', {
        stage: 'oura_page_fetch_errored',
        endpoint: params.endpoint,
        page,
        elapsedMs: Date.now() - pageStart,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(`Oura ${params.endpoint} request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      throw error;
    });
    if (!response.ok) {
      logger.warn('sync_job_stage', {
        stage: 'oura_page_fetch_non_ok',
        endpoint: params.endpoint,
        page,
        status: response.status,
        elapsedMs: Date.now() - pageStart,
      });
      throw new Error(`Oura ${params.endpoint} request failed with status ${response.status}`);
    }
    // eslint-disable-next-line no-await-in-loop
    const body = (await response.json()) as OuraCollectionPage<T>;
    logger.info('sync_job_stage', {
      stage: 'oura_page_fetch_done',
      endpoint: params.endpoint,
      page,
      elapsedMs: Date.now() - pageStart,
      recordCount: body.data.length,
      hasNextPage: Boolean(body.next_token),
    });
    results.push(...body.data);
    nextToken = body.next_token ?? undefined;
  } while (nextToken);

  return results;
}

export function fetchOuraDailySleep(
  accessToken: string,
  from: Date,
  to: Date,
): Promise<OuraDailySleepRecord[]> {
  return fetchOuraCollection<OuraDailySleepRecord>({ endpoint: 'daily_sleep', accessToken, from, to });
}

export function fetchOuraDailyReadiness(
  accessToken: string,
  from: Date,
  to: Date,
): Promise<OuraDailyReadinessRecord[]> {
  return fetchOuraCollection<OuraDailyReadinessRecord>({
    endpoint: 'daily_readiness',
    accessToken,
    from,
    to,
  });
}

export function fetchOuraDailyActivity(
  accessToken: string,
  from: Date,
  to: Date,
): Promise<OuraDailyActivityRecord[]> {
  return fetchOuraCollection<OuraDailyActivityRecord>({
    endpoint: 'daily_activity',
    accessToken,
    from,
    to,
  });
}

export function fetchOuraHeartRate(
  accessToken: string,
  from: Date,
  to: Date,
): Promise<OuraHeartRateRecord[]> {
  return fetchOuraCollection<OuraHeartRateRecord>({ endpoint: 'heartrate', accessToken, from, to });
}

export function fetchOuraWorkouts(
  accessToken: string,
  from: Date,
  to: Date,
): Promise<OuraWorkoutRecord[]> {
  return fetchOuraCollection<OuraWorkoutRecord>({ endpoint: 'workout', accessToken, from, to });
}

export function fetchOuraDailySpo2(
  accessToken: string,
  from: Date,
  to: Date,
): Promise<OuraDailySpo2Record[]> {
  return fetchOuraCollection<OuraDailySpo2Record>({ endpoint: 'daily_spo2', accessToken, from, to });
}
