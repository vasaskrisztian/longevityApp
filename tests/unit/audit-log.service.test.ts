import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  auditLog: {
    create: vi.fn(),
  },
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));

const { recordAuditLog, UnsafeAuditMetadataError } = await import('@/lib/audit/audit-log.service');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recordAuditLog', () => {
  it('writes the exact entry shape to prisma.auditLog.create when no metadata is given', async () => {
    prismaMock.auditLog.create.mockResolvedValue({});

    await recordAuditLog({
      actorUserId: 'admin-1',
      targetUserId: 'u1',
      action: 'ADMIN_VIEW_USER',
      entityType: 'User',
      entityId: 'u1',
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'admin-1',
        targetUserId: 'u1',
        action: 'ADMIN_VIEW_USER',
        entityType: 'User',
        entityId: 'u1',
        metadata: undefined,
      },
    });
  });

  it('passes through safe metadata unchanged', async () => {
    prismaMock.auditLog.create.mockResolvedValue({});

    await recordAuditLog({
      actorUserId: 'admin-1',
      targetUserId: 'u1',
      action: 'ADMIN_TRIGGER_SYNC',
      metadata: { reason: 'user requested', page: 2 },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadata: { reason: 'user requested', page: 2 } }),
    });
  });

  it('allows a null actorUserId/targetUserId (a system-initiated action)', async () => {
    prismaMock.auditLog.create.mockResolvedValue({});

    await recordAuditLog({ actorUserId: null, targetUserId: null, action: 'SYSTEM_CLEANUP' });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorUserId: null, targetUserId: null }),
    });
  });

  it.each([
    ['accessToken'],
    ['refresh_token'],
    ['Password'],
    ['clientSecret'],
    ['ciphertext'],
    ['authTag'],
    ['credentialId'],
  ])(
    'refuses to write and never calls prisma when metadata contains a forbidden-looking key: %s',
    async (key) => {
      await expect(
        recordAuditLog({
          actorUserId: 'admin-1',
          targetUserId: 'u1',
          action: 'ADMIN_VIEW_USER',
          metadata: { [key]: 'should never be logged' },
        }),
      ).rejects.toThrow(UnsafeAuditMetadataError);

      expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it('still refuses when only one of several metadata fields is unsafe', async () => {
    await expect(
      recordAuditLog({
        actorUserId: 'admin-1',
        targetUserId: 'u1',
        action: 'ADMIN_VIEW_USER',
        metadata: { reason: 'fine', apiToken: 'nope' },
      }),
    ).rejects.toThrow(UnsafeAuditMetadataError);

    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });
});
