import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  encryptedCredential: {
    updateMany: vi.fn(),
  },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const { PrismaCredentialLock, generateLockHolderId } = await import(
  '@/modules/wearable/services/credential-lock'
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PrismaCredentialLock#acquire', () => {
  it('acquires the lock via a single atomic updateMany when unlocked or stale', async () => {
    prismaMock.encryptedCredential.updateMany.mockResolvedValue({ count: 1 });
    const lock = new PrismaCredentialLock();

    const handle = await lock.acquire('conn-1', 'holder-a');

    expect(handle).toEqual({ connectionId: 'conn-1', holder: 'holder-a' });
    expect(prismaMock.encryptedCredential.updateMany).toHaveBeenCalledWith({
      where: {
        connectionId: 'conn-1',
        OR: [{ refreshLockedAt: null }, { refreshLockedAt: { lt: expect.any(Date) } }],
      },
      data: { refreshLockedAt: expect.any(Date), refreshLockedBy: 'holder-a' },
    });
  });

  it('returns null when the row is already locked by someone else (count 0)', async () => {
    prismaMock.encryptedCredential.updateMany.mockResolvedValue({ count: 0 });
    const lock = new PrismaCredentialLock();

    const handle = await lock.acquire('conn-1', 'holder-a');

    expect(handle).toBeNull();
  });

  it('simulates two concurrent callers racing for the same lock: only one succeeds', async () => {
    prismaMock.encryptedCredential.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const lock = new PrismaCredentialLock();

    const first = await lock.acquire('conn-1', 'holder-a');
    const second = await lock.acquire('conn-1', 'holder-b');

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('the WHERE clause allows stealing a stale (crashed-holder) lock — proven by asserting the exact filter shape', async () => {
    prismaMock.encryptedCredential.updateMany.mockResolvedValue({ count: 1 });
    const lock = new PrismaCredentialLock();

    await lock.acquire('conn-1', 'holder-new');

    const call = prismaMock.encryptedCredential.updateMany.mock.calls[0]?.[0];
    const staleClause = call.where.OR[1].refreshLockedAt.lt as Date;
    // The stale-before cutoff must be in the past relative to "now" (a lock
    // older than LOCK_TTL_MS is eligible to be stolen).
    expect(staleClause.getTime()).toBeLessThan(Date.now());
  });
});

describe('PrismaCredentialLock#release', () => {
  it('clears the lock guarded by holder match, so it can never clear a lock it no longer owns', async () => {
    prismaMock.encryptedCredential.updateMany.mockResolvedValue({ count: 1 });
    const lock = new PrismaCredentialLock();

    await lock.release({ connectionId: 'conn-1', holder: 'holder-a' });

    expect(prismaMock.encryptedCredential.updateMany).toHaveBeenCalledWith({
      where: { connectionId: 'conn-1', refreshLockedBy: 'holder-a' },
      data: { refreshLockedAt: null, refreshLockedBy: null },
    });
  });

  it('is a no-op (does not throw) when the lock was already stolen by someone else', async () => {
    prismaMock.encryptedCredential.updateMany.mockResolvedValue({ count: 0 });
    const lock = new PrismaCredentialLock();

    await expect(
      lock.release({ connectionId: 'conn-1', holder: 'holder-a' }),
    ).resolves.toBeUndefined();
  });
});

describe('generateLockHolderId', () => {
  it('generates a non-empty hex string, different on every call', () => {
    const a = generateLockHolderId();
    const b = generateLockHolderId();

    expect(a).toMatch(/^[0-9a-f]+$/);
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
