/**
 * ARCHITECTURE.md §7.4's retry schedule for transient fetch failures (429 /
 * 5xx / timeout): "exponential backoff retry: 1min, 5min, 30min". A pure
 * function so the exact schedule is unit-tested without a real queue —
 * `jobs/wearable-sync.job.ts` wires this in as BullMQ's `backoffStrategy`.
 *
 * `attemptsMade` is BullMQ's 1-indexed count of attempts made so far when a
 * job fails (1 after the first failure, 2 after the second, ...) — the
 * delay returned is how long to wait before the *next* attempt.
 */
const BACKOFF_SCHEDULE_MS = [60_000, 5 * 60_000, 30 * 60_000] as const;

export function computeBackoffDelayMs(attemptsMade: number): number {
  const index = Math.min(attemptsMade, BACKOFF_SCHEDULE_MS.length) - 1;
  return BACKOFF_SCHEDULE_MS[Math.max(index, 0)]!;
}

/**
 * One initial attempt + three retries (1min/5min/30min) matches the
 * three-step schedule above exactly — a fourth attempt with no further
 * schedule entry would just repeat the last (30min) delay via
 * `computeBackoffDelayMs`'s clamping, so capping at 4 total attempts keeps
 * the configured schedule and the actual retry count in sync.
 */
export const MAX_SYNC_JOB_ATTEMPTS = 4;

/**
 * Only a fully-failed sync with a transient fetch error is worth retrying.
 * `AUTH_REQUIRED` means the refresh token itself was rejected — retrying
 * immediately would hit the exact same rejection every time until the user
 * reconnects (§6.2), so retrying it would just burn through the backoff
 * schedule for no reason. A `PARTIAL` result is not a failure at all: some
 * endpoints succeeded and their data is already stored/normalized, and the
 * next scheduled daily sync's 2-day overlap (§7.3) naturally re-covers
 * whatever the failed endpoint(s) missed — so it is never retried here.
 */
export function isRetryableSyncFailure(params: {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  errorCode: string | undefined;
}): boolean {
  return params.status === 'FAILED' && params.errorCode === 'FETCH_FAILED';
}
