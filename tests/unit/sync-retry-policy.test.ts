import { describe, it, expect } from 'vitest';
import {
  computeBackoffDelayMs,
  isRetryableSyncFailure,
  MAX_SYNC_JOB_ATTEMPTS,
} from '@/modules/wearable/services/sync-retry-policy';

describe('computeBackoffDelayMs', () => {
  it('waits 1 minute before the 2nd attempt (after the 1st failure)', () => {
    expect(computeBackoffDelayMs(1)).toBe(60_000);
  });

  it('waits 5 minutes before the 3rd attempt (after the 2nd failure)', () => {
    expect(computeBackoffDelayMs(2)).toBe(5 * 60_000);
  });

  it('waits 30 minutes before the 4th attempt (after the 3rd failure)', () => {
    expect(computeBackoffDelayMs(3)).toBe(30 * 60_000);
  });

  it('clamps to the last schedule entry (30 minutes) beyond the defined schedule', () => {
    expect(computeBackoffDelayMs(4)).toBe(30 * 60_000);
    expect(computeBackoffDelayMs(99)).toBe(30 * 60_000);
  });

  it('never returns a negative or zero delay even for attemptsMade=0', () => {
    expect(computeBackoffDelayMs(0)).toBe(60_000);
  });
});

describe('MAX_SYNC_JOB_ATTEMPTS', () => {
  it('is 1 initial attempt plus the 3-step backoff schedule', () => {
    expect(MAX_SYNC_JOB_ATTEMPTS).toBe(4);
  });
});

describe('isRetryableSyncFailure', () => {
  it('retries a FAILED sync with FETCH_FAILED (transient endpoint failure)', () => {
    expect(isRetryableSyncFailure({ status: 'FAILED', errorCode: 'FETCH_FAILED' })).toBe(true);
  });

  it('does not retry a FAILED sync with AUTH_REQUIRED — retrying hits the same rejection', () => {
    expect(isRetryableSyncFailure({ status: 'FAILED', errorCode: 'AUTH_REQUIRED' })).toBe(false);
  });

  it('does not retry a PARTIAL sync — it already stored what it could, the next daily sync covers the rest', () => {
    expect(isRetryableSyncFailure({ status: 'PARTIAL', errorCode: 'PARTIAL_FETCH_FAILURE' })).toBe(
      false,
    );
  });

  it('does not retry a SUCCESS result', () => {
    expect(isRetryableSyncFailure({ status: 'SUCCESS', errorCode: undefined })).toBe(false);
  });
});
