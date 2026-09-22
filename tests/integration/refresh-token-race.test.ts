import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CredentialLock, LockHandle } from '@/modules/wearable/domain/credential-lock.types';
import type { WearableProviderAdapter } from '@/modules/wearable/domain/wearable-provider.types';

/**
 * ARCHITECTURE.md §10.7's mandatory concurrency test, quoted directly:
 *
 *   "Two simulated workers call the refresh path for the same
 *   WearableConnection at the same time. Expected: exactly one request
 *   reaches Oura's token endpoint; the second worker observes the
 *   already-refreshed credential and uses it; refreshVersion increments
 *   exactly once; no AUTH_REQUIRED state is incorrectly produced by the
 *   "loser.""
 *
 * refresh-credential.service.test.ts and credential-lock.test.ts already
 * unit-test every piece of this in isolation, but each does so with
 * pre-scripted `mockResolvedValueOnce` sequences — a fixed, assumed call
 * order, not two calls actually racing. This file is the one place that
 * runs two real, concurrent `ensureFreshAccessToken` calls (via
 * `Promise.all`) against a SHARED, mutable fake lock and credential store,
 * so the interleaving is genuine rather than scripted — as close to §10.7's
 * "two simulated workers" as this sandbox's no-live-Postgres constraint
 * (documented in every phase since Phase 1) allows.
 */

interface FakeCredentialRow {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshVersion: number;
}

/** A shared row both simulated workers read from and write to — the key difference from the scripted per-call mocks in the unit test files. */
function createFakeCredentialStore(initial: FakeCredentialRow) {
  let row: FakeCredentialRow = { ...initial };
  return {
    load: vi.fn(async (_connectionId: string) => ({ ...row })),
    rotate: vi.fn(
      async (
        _connectionId: string,
        tokenSet: { accessToken: string; accessTokenExpiresAt: Date; refreshToken: string },
        expectedVersion: number,
      ) => {
        // Same optimistic-concurrency contract as the real rotateCredential.
        if (row.refreshVersion !== expectedVersion) {
          return false;
        }
        row = {
          accessToken: tokenSet.accessToken,
          accessTokenExpiresAt: tokenSet.accessTokenExpiresAt,
          refreshToken: tokenSet.refreshToken,
          refreshVersion: row.refreshVersion + 1,
        };
        return true;
      },
    ),
    getRow: () => row,
  };
}

/**
 * A real single-winner lock, in memory — the same guarantee
 * `PrismaCredentialLock`'s atomic `updateMany` gives via Postgres row
 * locking (asserted in isolation by credential-lock.test.ts), reimplemented
 * here so this test can run two genuinely concurrent callers against it.
 */
function createFakeSingleWinnerLock(): CredentialLock {
  let heldBy: string | null = null;
  return {
    async acquire(connectionId: string, holder: string): Promise<LockHandle | null> {
      if (heldBy !== null) {
        return null;
      }
      heldBy = holder;
      return { connectionId, holder };
    },
    async release(handle: LockHandle): Promise<void> {
      if (heldBy === handle.holder) {
        heldBy = null;
      }
    },
  };
}

const markConnectionAuthRequiredMock = vi.fn();
vi.mock('@/modules/wearable/services/wearable.service', () => ({
  markConnectionAuthRequired: markConnectionAuthRequiredMock,
}));

// credential-lock.ts imports '@/lib/db/prisma' at module load time; every
// test here injects its own fake lock, so PrismaCredentialLock is never
// instantiated, but the import itself must not blow up without a real DB.
vi.mock('@/lib/db/prisma', () => ({ prisma: {} }));

let store: ReturnType<typeof createFakeCredentialStore>;
vi.mock('@/modules/wearable/services/credential-vault.service', () => ({
  loadCredential: (connectionId: string) => store.load(connectionId),
  rotateCredential: (
    connectionId: string,
    tokenSet: { accessToken: string; accessTokenExpiresAt: Date; refreshToken: string },
    version: number,
  ) => store.rotate(connectionId, tokenSet, version),
}));

const { ensureFreshAccessToken } = await import(
  '@/modules/wearable/services/refresh-credential.service'
);

function fakeAdapter(overrides: Partial<WearableProviderAdapter> = {}): WearableProviderAdapter {
  return {
    id: 'OURA',
    getRedirectUri: () => 'https://app.example.com/callback',
    buildAuthorizationUrl: () => 'https://provider.example.com/authorize',
    exchangeAuthorizationCode: vi.fn(),
    refreshAccessToken: vi.fn(),
    revokeTokens: vi.fn(),
    fetchRawData: vi.fn(),
    mapToNormalizedFields: vi.fn(),
    mapToWorkout: vi.fn(),
    ...overrides,
  };
}

const ALREADY_EXPIRED = new Date(Date.now() - 60_000);

beforeEach(() => {
  vi.clearAllMocks();
  store = createFakeCredentialStore({
    accessToken: 'stale-access',
    accessTokenExpiresAt: ALREADY_EXPIRED,
    refreshToken: 'stale-refresh',
    refreshVersion: 0,
  });
});

describe('§10.7 — two workers race to refresh the same WearableConnection', () => {
  it('exactly one call reaches the provider; the loser gets the winner\'s fresh token; refreshVersion increments exactly once; AUTH_REQUIRED is never incorrectly produced', async () => {
    const lock = createFakeSingleWinnerLock();
    let refreshCallCount = 0;
    const adapter = fakeAdapter({
      refreshAccessToken: vi.fn(async () => {
        refreshCallCount += 1;
        // The artificial delay is what makes the race genuine: without it,
        // a single-threaded event loop could run both calls' synchronous
        // portions to completion before either ever awaits, which would
        // prove nothing about the lock actually serializing them.
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          accessToken: `new-access-${refreshCallCount}`,
          accessTokenExpiresAt: new Date(Date.now() + 3600_000),
          refreshToken: `new-refresh-${refreshCallCount}`,
          grantedScopes: ['personal'],
        };
      }),
    });

    // Two "workers" calling the exact same refresh path for the exact same
    // connection, launched together — this is what makes it a race rather
    // than two sequential calls.
    const [resultA, resultB] = await Promise.all([
      ensureFreshAccessToken('conn-1', adapter, { lock, lockAcquireAttempts: 20, lockAcquireRetryDelayMs: 5 }),
      ensureFreshAccessToken('conn-1', adapter, { lock, lockAcquireAttempts: 20, lockAcquireRetryDelayMs: 5 }),
    ]);

    // Guarantee #1 (§6.2): only one worker ever reaches the provider.
    expect(adapter.refreshAccessToken).toHaveBeenCalledTimes(1);
    // Guarantee #2: the loser observes the already-refreshed credential
    // instead of calling the provider itself or getting a stale result —
    // both calls resolve to the identical, single new token.
    expect(resultA).toEqual(resultB);
    expect(resultA.accessToken).toBe('new-access-1');
    // Guarantee #3: exactly one atomic rotation happened, not two.
    expect(store.getRow().refreshVersion).toBe(1);
    expect(store.rotate).toHaveBeenCalledTimes(1);
    // The "loser" must never be misclassified as needing reconnection.
    expect(markConnectionAuthRequiredMock).not.toHaveBeenCalled();
  });
});
