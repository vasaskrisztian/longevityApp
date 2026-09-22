import type { SyncJobType } from '@prisma/client';

/**
 * ARCHITECTURE.md §7.1/§7.3's window rules, as a pure function — no I/O, so
 * every branch is exercised without touching Prisma:
 *
 *   INITIAL (or any job type when the connection has never had a successful
 *   sync yet) -> last 30 days, per §7.1/§11 ("fetch last 30 days" / "≥30
 *   days of mock data").
 *
 *   DAILY/MANUAL with a prior successful sync -> `lastSuccessfulSyncAt - 2
 *   days` through today, per §7.3's safety overlap (Oura's own daily scores
 *   can be revised after the fact, so re-fetching and upserting the last two
 *   days is deliberate, not a bug).
 *
 * `to` is always "now" — there is no reason to ever stop short of the
 * current moment for either window.
 */
const INITIAL_WINDOW_DAYS = 30;
const INCREMENTAL_OVERLAP_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface SyncWindow {
  from: Date;
  to: Date;
}

export function computeSyncWindow(params: {
  type: SyncJobType;
  lastSuccessfulSyncAt: Date | null;
  now: Date;
}): SyncWindow {
  const { type, lastSuccessfulSyncAt, now } = params;

  if (type === 'INITIAL' || !lastSuccessfulSyncAt) {
    return {
      from: new Date(now.getTime() - INITIAL_WINDOW_DAYS * MS_PER_DAY),
      to: now,
    };
  }

  return {
    from: new Date(lastSuccessfulSyncAt.getTime() - INCREMENTAL_OVERLAP_DAYS * MS_PER_DAY),
    to: now,
  };
}
