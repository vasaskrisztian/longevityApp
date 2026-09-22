import { loadCredential, rotateCredential } from './credential-vault.service';
import { PrismaCredentialLock, generateLockHolderId } from './credential-lock';
import { markConnectionAuthRequired } from './wearable.service';
import {
  CredentialNotFoundError,
  CredentialLockTimeoutError,
  CredentialVersionConflictError,
} from '../domain/errors';
import type { CredentialLock } from '../domain/credential-lock.types';
import type { WearableProviderAdapter } from '../domain/wearable-provider.types';

/**
 * ARCHITECTURE.md §6's rotating-refresh-token flow. Not called by any route
 * yet in Phase 4 — the callback stores a freshly-issued, non-expired token,
 * so nothing needs a refresh the moment a connection is created. Phase
 * 5/6/7's ingestion and sync-job code is the intended caller: "get a usable
 * access token for this connection, refreshing it first if needed."
 *
 * The four guarantees from §6.2, and how this satisfies each:
 *  1. Only one worker reaches the provider's token endpoint at a time —
 *     `CredentialLock.acquire` is a single atomic DB write (see
 *     credential-lock.ts); only one concurrent caller can ever hold it.
 *  2. The second worker never uses a dead refresh token — after acquiring
 *     the lock we re-read the credential and re-check whether it still
 *     needs refreshing before calling the provider at all.
 *  3. New tokens are persisted atomically — `rotateCredential`'s
 *     optimistic-concurrency `updateMany` either fully applies or is a no-op.
 *  4. `EncryptedCredential` is the source of truth — no token is cached
 *     anywhere in this module beyond the single call that needed it.
 */

// Refresh a bit before actual expiry so a caller never receives a token that
// expires mid-request.
const REFRESH_SAFETY_MARGIN_MS = 60_000;
const DEFAULT_LOCK_ACQUIRE_ATTEMPTS = 5;
const DEFAULT_LOCK_ACQUIRE_RETRY_DELAY_MS = 200;

export interface FreshAccessToken {
  accessToken: string;
  accessTokenExpiresAt: Date;
}

export interface EnsureFreshAccessTokenOptions {
  lock?: CredentialLock;
  lockAcquireAttempts?: number;
  lockAcquireRetryDelayMs?: number;
}

function needsRefresh(accessTokenExpiresAt: Date): boolean {
  return accessTokenExpiresAt.getTime() <= Date.now() + REFRESH_SAFETY_MARGIN_MS;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureFreshAccessToken(
  connectionId: string,
  adapter: WearableProviderAdapter,
  options: EnsureFreshAccessTokenOptions = {},
): Promise<FreshAccessToken> {
  const lock = options.lock ?? new PrismaCredentialLock();
  const attempts = options.lockAcquireAttempts ?? DEFAULT_LOCK_ACQUIRE_ATTEMPTS;
  const retryDelayMs = options.lockAcquireRetryDelayMs ?? DEFAULT_LOCK_ACQUIRE_RETRY_DELAY_MS;

  const current = await loadCredential(connectionId);
  if (!current) {
    throw new CredentialNotFoundError(connectionId);
  }
  if (!needsRefresh(current.accessTokenExpiresAt)) {
    return { accessToken: current.accessToken, accessTokenExpiresAt: current.accessTokenExpiresAt };
  }

  const holder = generateLockHolderId();
  let handle = await lock.acquire(connectionId, holder);
  for (let attempt = 1; !handle && attempt < attempts; attempt += 1) {
    await sleep(retryDelayMs);
    handle = await lock.acquire(connectionId, holder);
  }
  if (!handle) {
    throw new CredentialLockTimeoutError(connectionId);
  }

  try {
    // Re-check inside the lock: another worker may have already refreshed
    // while we were waiting to acquire it (guarantee #2) — in which case we
    // use the now-fresh credential instead of calling the provider again.
    const fresh = await loadCredential(connectionId);
    if (!fresh) {
      throw new CredentialNotFoundError(connectionId);
    }
    if (!needsRefresh(fresh.accessTokenExpiresAt)) {
      return { accessToken: fresh.accessToken, accessTokenExpiresAt: fresh.accessTokenExpiresAt };
    }

    let tokenSet;
    try {
      tokenSet = await adapter.refreshAccessToken({ refreshToken: fresh.refreshToken });
    } catch (error) {
      // A crash or a rejected refresh both land here: the connection needs
      // the user to reconnect rather than being silently retried with a
      // refresh token that may already be dead (ARCHITECTURE.md §6.2 guarantee #3).
      await markConnectionAuthRequired(connectionId);
      throw error;
    }

    const rotated = await rotateCredential(connectionId, tokenSet, fresh.refreshVersion);
    if (!rotated) {
      // Shouldn't happen while we hold the advisory lock — would indicate a
      // bug (e.g. the lock was bypassed) rather than a legitimate race.
      throw new CredentialVersionConflictError(connectionId);
    }

    return { accessToken: tokenSet.accessToken, accessTokenExpiresAt: tokenSet.accessTokenExpiresAt };
  } finally {
    await lock.release(handle);
  }
}
