import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import type { CredentialLock, LockHandle } from '../domain/credential-lock.types';

/**
 * ARCHITECTURE.md §6.1's CredentialLock, backed by
 * EncryptedCredential.refreshLockedAt/refreshLockedBy — an application-level
 * advisory lock rather than a raw-SQL `SELECT ... FOR UPDATE` transaction.
 * Both approaches satisfy the same guarantees (§6.2); this one stays inside
 * Prisma's regular typed API (no raw SQL against un-`@map`ped column names
 * to get wrong), and the doc explicitly allows swapping in a distributed
 * Redis lock later without any caller-visible change — this is that same
 * kind of swap, just Postgres-backed instead of Redis-backed.
 *
 * `acquire` is a single atomic `updateMany`: two callers racing for the same
 * connectionId can never both see `count === 1`, because Postgres serializes
 * concurrent UPDATEs to the same row — the loser's WHERE clause simply no
 * longer matches (the row's refreshLockedAt is no longer null) by the time
 * its UPDATE runs. A lock older than LOCK_TTL_MS is treated as abandoned
 * (a crashed holder) and can be stolen — see the `OR` clause.
 */

const LOCK_TTL_MS = 30_000;

export class PrismaCredentialLock implements CredentialLock {
  async acquire(connectionId: string, holder: string): Promise<LockHandle | null> {
    const staleBefore = new Date(Date.now() - LOCK_TTL_MS);
    const result = await prisma.encryptedCredential.updateMany({
      where: {
        connectionId,
        OR: [{ refreshLockedAt: null }, { refreshLockedAt: { lt: staleBefore } }],
      },
      data: { refreshLockedAt: new Date(), refreshLockedBy: holder },
    });
    return result.count === 1 ? { connectionId, holder } : null;
  }

  async release(handle: LockHandle): Promise<void> {
    // Guarded by holder match so we never clear a lock we no longer own
    // (e.g. one that was already declared stale and stolen by someone else
    // while we were mid-refresh).
    await prisma.encryptedCredential.updateMany({
      where: { connectionId: handle.connectionId, refreshLockedBy: handle.holder },
      data: { refreshLockedAt: null, refreshLockedBy: null },
    });
  }
}

export function generateLockHolderId(): string {
  return randomBytes(8).toString('hex');
}
