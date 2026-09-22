/**
 * The advisory-lock contract from ARCHITECTURE.md §6.1, verbatim. Pure
 * interface, zero I/O — `modules/wearable/services/credential-lock.ts`
 * implements this against `EncryptedCredential.refreshLockedAt`/
 * `refreshLockedBy`. Architecture note: "a distributed Redis lock is an
 * acceptable alternative if the worker fleet needs it — the interface is
 * the same either way," so a future swap to Redis only touches the
 * implementation, never callers of `ensureFreshAccessToken()`.
 */
export interface LockHandle {
  connectionId: string;
  holder: string;
}

export interface CredentialLock {
  acquire(connectionId: string, holder: string): Promise<LockHandle | null>;
  release(handle: LockHandle): Promise<void>;
}
