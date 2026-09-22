import { describe, it, expect } from 'vitest';
import { computeSyncWindow } from '@/modules/wearable/services/sync-window.service';

const NOW = new Date('2026-06-15T12:00:00Z');

describe('computeSyncWindow', () => {
  it('returns a 30-day window for an INITIAL job regardless of lastSuccessfulSyncAt', () => {
    const window = computeSyncWindow({ type: 'INITIAL', lastSuccessfulSyncAt: null, now: NOW });

    expect(window.to).toEqual(NOW);
    expect(window.from).toEqual(new Date('2026-05-16T12:00:00Z'));
  });

  it('returns a 30-day window for a DAILY job when the connection has never synced successfully', () => {
    const window = computeSyncWindow({ type: 'DAILY', lastSuccessfulSyncAt: null, now: NOW });

    expect(window.from).toEqual(new Date('2026-05-16T12:00:00Z'));
    expect(window.to).toEqual(NOW);
  });

  it('returns a 30-day window for a MANUAL job when the connection has never synced successfully', () => {
    const window = computeSyncWindow({ type: 'MANUAL', lastSuccessfulSyncAt: null, now: NOW });

    expect(window.from).toEqual(new Date('2026-05-16T12:00:00Z'));
  });

  it('returns lastSuccessfulSyncAt minus a 2-day overlap for a DAILY job with prior success', () => {
    const lastSuccessfulSyncAt = new Date('2026-06-14T08:00:00Z');

    const window = computeSyncWindow({ type: 'DAILY', lastSuccessfulSyncAt, now: NOW });

    expect(window.from).toEqual(new Date('2026-06-12T08:00:00Z'));
    expect(window.to).toEqual(NOW);
  });

  it('returns lastSuccessfulSyncAt minus a 2-day overlap for a MANUAL job with prior success', () => {
    const lastSuccessfulSyncAt = new Date('2026-06-14T08:00:00Z');

    const window = computeSyncWindow({ type: 'MANUAL', lastSuccessfulSyncAt, now: NOW });

    expect(window.from).toEqual(new Date('2026-06-12T08:00:00Z'));
  });

  it('an INITIAL job with a lastSuccessfulSyncAt still uses the 30-day window, never the 2-day overlap', () => {
    // Shouldn't normally happen (a connection with a prior success wouldn't
    // get a fresh INITIAL job), but the type check must come first regardless.
    const window = computeSyncWindow({
      type: 'INITIAL',
      lastSuccessfulSyncAt: new Date('2026-06-14T08:00:00Z'),
      now: NOW,
    });

    expect(window.from).toEqual(new Date('2026-05-16T12:00:00Z'));
  });
});
