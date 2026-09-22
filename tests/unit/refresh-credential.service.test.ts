import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CredentialLock, LockHandle } from '@/modules/wearable/domain/credential-lock.types';
import type { WearableProviderAdapter } from '@/modules/wearable/domain/wearable-provider.types';

const loadCredentialMock = vi.fn();
const rotateCredentialMock = vi.fn();
vi.mock('@/modules/wearable/services/credential-vault.service', () => ({
  loadCredential: loadCredentialMock,
  rotateCredential: rotateCredentialMock,
}));

const markConnectionAuthRequiredMock = vi.fn();
vi.mock('@/modules/wearable/services/wearable.service', () => ({
  markConnectionAuthRequired: markConnectionAuthRequiredMock,
}));

// credential-lock.ts is not mocked wholesale — every test supplies its own
// fake CredentialLock via options.lock, which ensure-fresh-access-token was
// deliberately designed to accept for exactly this reason. We still need to
// stub generateLockHolderId's module since credential-lock.ts imports
// '@/lib/db/prisma' at module load time, which would otherwise blow up
// without a real DB.
vi.mock('@/lib/db/prisma', () => ({ prisma: {} }));

const { ensureFreshAccessToken } = await import(
  '@/modules/wearable/services/refresh-credential.service'
);
const {
  CredentialNotFoundError,
  CredentialLockTimeoutError,
  CredentialVersionConflictError,
} = await import('@/modules/wearable/domain/errors');

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

/** A fake lock that always succeeds immediately — the common case. */
function alwaysAvailableLock(): CredentialLock {
  return {
    acquire: vi.fn(async (connectionId: string, holder: string): Promise<LockHandle | null> => ({
      connectionId,
      holder,
    })),
    release: vi.fn(async () => undefined),
  };
}

const FAR_FUTURE = new Date(Date.now() + 10 * 60_000);
const ALREADY_EXPIRED = new Date(Date.now() - 60_000);
const NEW_TOKEN_SET = {
  accessToken: 'new-access',
  accessTokenExpiresAt: new Date(Date.now() + 3600_000),
  refreshToken: 'new-refresh',
  grantedScopes: ['personal'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureFreshAccessToken — fast path (no refresh needed)', () => {
  it('defaults to a real PrismaCredentialLock when no lock is injected (never touched on the fast path)', async () => {
    loadCredentialMock.mockResolvedValue({
      accessToken: 'still-good',
      accessTokenExpiresAt: FAR_FUTURE,
      refreshToken: 'rt',
      refreshVersion: 3,
    });
    const adapter = fakeAdapter();

    // No `options` at all — exercises `options.lock ?? new PrismaCredentialLock()`.
    // Constructing PrismaCredentialLock does no I/O, and the fast path never
    // calls acquire/release, so this is safe without a real Prisma client.
    const result = await ensureFreshAccessToken('conn-1', adapter);

    expect(result).toEqual({ accessToken: 'still-good', accessTokenExpiresAt: FAR_FUTURE });
  });

  it('returns the current token without acquiring the lock or calling the adapter', async () => {
    loadCredentialMock.mockResolvedValue({
      accessToken: 'still-good',
      accessTokenExpiresAt: FAR_FUTURE,
      refreshToken: 'rt',
      refreshVersion: 3,
    });
    const lock = alwaysAvailableLock();
    const adapter = fakeAdapter();

    const result = await ensureFreshAccessToken('conn-1', adapter, { lock });

    expect(result).toEqual({ accessToken: 'still-good', accessTokenExpiresAt: FAR_FUTURE });
    expect(lock.acquire).not.toHaveBeenCalled();
    expect(adapter.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('throws CredentialNotFoundError when no credential row exists', async () => {
    loadCredentialMock.mockResolvedValue(null);
    const adapter = fakeAdapter();

    await expect(
      ensureFreshAccessToken('conn-missing', adapter, { lock: alwaysAvailableLock() }),
    ).rejects.toThrow(CredentialNotFoundError);
  });
});

describe('ensureFreshAccessToken — lock acquired, refresh succeeds', () => {
  it('acquires the lock, refreshes, rotates the credential, and releases the lock', async () => {
    loadCredentialMock.mockResolvedValue({
      accessToken: 'stale',
      accessTokenExpiresAt: ALREADY_EXPIRED,
      refreshToken: 'old-refresh',
      refreshVersion: 2,
    });
    rotateCredentialMock.mockResolvedValue(true);
    const lock = alwaysAvailableLock();
    const adapter = fakeAdapter({
      refreshAccessToken: vi.fn().mockResolvedValue(NEW_TOKEN_SET),
    });

    const result = await ensureFreshAccessToken('conn-1', adapter, { lock });

    expect(adapter.refreshAccessToken).toHaveBeenCalledWith({ refreshToken: 'old-refresh' });
    expect(rotateCredentialMock).toHaveBeenCalledWith('conn-1', NEW_TOKEN_SET, 2);
    expect(result).toEqual({
      accessToken: NEW_TOKEN_SET.accessToken,
      accessTokenExpiresAt: NEW_TOKEN_SET.accessTokenExpiresAt,
    });
    expect(lock.release).toHaveBeenCalledWith({ connectionId: 'conn-1', holder: expect.any(String) });
  });
});

describe('ensureFreshAccessToken — lock retry loop', () => {
  it('retries acquisition (sleeping a positive delay between attempts) and proceeds once the lock frees up', async () => {
    loadCredentialMock.mockResolvedValue({
      accessToken: 'stale',
      accessTokenExpiresAt: ALREADY_EXPIRED,
      refreshToken: 'old-refresh',
      refreshVersion: 2,
    });
    rotateCredentialMock.mockResolvedValue(true);
    const lock: CredentialLock = {
      acquire: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ connectionId: 'conn-1', holder: 'h' }),
      release: vi.fn(),
    };
    const adapter = fakeAdapter({
      refreshAccessToken: vi.fn().mockResolvedValue(NEW_TOKEN_SET),
    });

    const result = await ensureFreshAccessToken('conn-1', adapter, {
      lock,
      lockAcquireRetryDelayMs: 1,
    });

    expect(lock.acquire).toHaveBeenCalledTimes(2);
    expect(result.accessToken).toBe(NEW_TOKEN_SET.accessToken);
  });
});

describe('ensureFreshAccessToken — credential disappears between the fast-path read and the lock', () => {
  it('throws CredentialNotFoundError if the credential is gone by the time the lock is held', async () => {
    loadCredentialMock
      .mockResolvedValueOnce({
        accessToken: 'stale',
        accessTokenExpiresAt: ALREADY_EXPIRED,
        refreshToken: 'old-refresh',
        refreshVersion: 2,
      })
      .mockResolvedValueOnce(null);
    const lock = alwaysAvailableLock();
    const adapter = fakeAdapter();

    await expect(ensureFreshAccessToken('conn-1', adapter, { lock })).rejects.toThrow(
      CredentialNotFoundError,
    );
    expect(lock.release).toHaveBeenCalled();
  });
});

describe('ensureFreshAccessToken — another worker already refreshed while we waited', () => {
  it('re-checks freshness inside the lock and returns the now-fresh token without calling the adapter', async () => {
    loadCredentialMock
      .mockResolvedValueOnce({
        accessToken: 'stale',
        accessTokenExpiresAt: ALREADY_EXPIRED,
        refreshToken: 'old-refresh',
        refreshVersion: 2,
      })
      .mockResolvedValueOnce({
        accessToken: 'refreshed-by-someone-else',
        accessTokenExpiresAt: FAR_FUTURE,
        refreshToken: 'newer-refresh',
        refreshVersion: 3,
      });
    const lock = alwaysAvailableLock();
    const adapter = fakeAdapter();

    const result = await ensureFreshAccessToken('conn-1', adapter, { lock });

    expect(result).toEqual({
      accessToken: 'refreshed-by-someone-else',
      accessTokenExpiresAt: FAR_FUTURE,
    });
    expect(adapter.refreshAccessToken).not.toHaveBeenCalled();
    expect(lock.release).toHaveBeenCalled();
  });
});

describe('ensureFreshAccessToken — refresh fails', () => {
  it('marks the connection AUTH_REQUIRED, releases the lock, and rethrows', async () => {
    loadCredentialMock.mockResolvedValue({
      accessToken: 'stale',
      accessTokenExpiresAt: ALREADY_EXPIRED,
      refreshToken: 'dead-refresh',
      refreshVersion: 1,
    });
    const lock = alwaysAvailableLock();
    const refreshError = new Error('invalid_grant');
    const adapter = fakeAdapter({
      refreshAccessToken: vi.fn().mockRejectedValue(refreshError),
    });

    await expect(ensureFreshAccessToken('conn-1', adapter, { lock })).rejects.toThrow(refreshError);

    expect(markConnectionAuthRequiredMock).toHaveBeenCalledWith('conn-1');
    expect(rotateCredentialMock).not.toHaveBeenCalled();
    expect(lock.release).toHaveBeenCalled();
  });
});

describe('ensureFreshAccessToken — lock acquisition times out', () => {
  it('throws CredentialLockTimeoutError after exhausting the retry budget, without calling the adapter', async () => {
    loadCredentialMock.mockResolvedValue({
      accessToken: 'stale',
      accessTokenExpiresAt: ALREADY_EXPIRED,
      refreshToken: 'rt',
      refreshVersion: 1,
    });
    const neverAvailableLock: CredentialLock = {
      acquire: vi.fn().mockResolvedValue(null),
      release: vi.fn(),
    };
    const adapter = fakeAdapter();

    await expect(
      ensureFreshAccessToken('conn-1', adapter, {
        lock: neverAvailableLock,
        lockAcquireAttempts: 3,
        lockAcquireRetryDelayMs: 0,
      }),
    ).rejects.toThrow(CredentialLockTimeoutError);

    expect(neverAvailableLock.acquire).toHaveBeenCalledTimes(3);
    expect(adapter.refreshAccessToken).not.toHaveBeenCalled();
    expect(neverAvailableLock.release).not.toHaveBeenCalled();
  });
});

describe('ensureFreshAccessToken — CAS conflict on rotate', () => {
  it('throws CredentialVersionConflictError when rotateCredential unexpectedly reports a mismatch', async () => {
    loadCredentialMock.mockResolvedValue({
      accessToken: 'stale',
      accessTokenExpiresAt: ALREADY_EXPIRED,
      refreshToken: 'old-refresh',
      refreshVersion: 2,
    });
    rotateCredentialMock.mockResolvedValue(false);
    const lock = alwaysAvailableLock();
    const adapter = fakeAdapter({
      refreshAccessToken: vi.fn().mockResolvedValue(NEW_TOKEN_SET),
    });

    await expect(ensureFreshAccessToken('conn-1', adapter, { lock })).rejects.toThrow(
      CredentialVersionConflictError,
    );
    expect(lock.release).toHaveBeenCalled();
  });
});
