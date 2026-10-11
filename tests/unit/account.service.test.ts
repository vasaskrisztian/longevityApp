import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  mobileRefreshToken: { updateMany: vi.fn() },
  $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
};
vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logging/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const recordAuditLog = vi.fn();
vi.mock('@/lib/audit/audit-log.service', () => ({ recordAuditLog }));
const verifyPassword = vi.fn();
const hashPassword = vi.fn();
vi.mock('@/lib/auth/password', () => ({ verifyPassword, hashPassword }));
const revokeProviderAccessForUser = vi.fn();
vi.mock('@/modules/wearable/services/provider-access.service', () => ({ revokeProviderAccessForUser }));

const { changePassword, deleteAccount } = await import('@/modules/auth/account.service');

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ passwordHash: 'hash', role: 'USER' });
  verifyPassword.mockResolvedValue(true);
  hashPassword.mockResolvedValue('new-hash');
  revokeProviderAccessForUser.mockResolvedValue(undefined);
});

describe('changePassword', () => {
  it('rejects a wrong current password without changing anything', async () => {
    verifyPassword.mockResolvedValue(false);
    expect(await changePassword('u1', 'bad', 'NewPassword123')).toBe('wrong_password');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.mobileRefreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('is unavailable for an account without a password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: null });
    expect(await changePassword('u1', 'x', 'NewPassword123')).toBe('unavailable');
  });

  it('stores the new hash and revokes every active mobile refresh token', async () => {
    expect(await changePassword('u1', 'OldPassword123', 'NewPassword123')).toBe('ok');
    expect(hashPassword).toHaveBeenCalledWith('NewPassword123');
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { passwordHash: 'new-hash' } });
    expect(prismaMock.mobileRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_CHANGE_PASSWORD', actorUserId: 'u1' }));
  });

  it('never puts the password in the audit log', async () => {
    await changePassword('u1', 'OldPassword123', 'NewPassword123');
    expect(JSON.stringify(recordAuditLog.mock.calls)).not.toContain('Password123');
  });
});

describe('deleteAccount', () => {
  it('rejects a wrong password and deletes nothing', async () => {
    verifyPassword.mockResolvedValue(false);
    expect(await deleteAccount('u1', 'bad')).toBe('wrong_password');
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it('refuses administrators', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: 'hash', role: 'ADMIN' });
    expect(await deleteAccount('u1', 'pw')).toBe('admin_account');
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it('is unavailable without a password hash', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: null, role: 'USER' });
    expect(await deleteAccount('u1', 'pw')).toBe('unavailable');
  });

  it('writes the audit row first and then deletes the user', async () => {
    const order: string[] = [];
    recordAuditLog.mockImplementation(async () => void order.push('audit'));
    prismaMock.user.delete.mockImplementation(async () => void order.push('delete'));
    expect(await deleteAccount('u1', 'pw')).toBe('ok');
    expect(order).toEqual(['audit', 'delete']);
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('revokes provider access before deleting the user', async () => {
    const order: string[] = [];
    revokeProviderAccessForUser.mockImplementation(async () => void order.push('revoke'));
    prismaMock.user.delete.mockImplementation(async () => void order.push('delete'));
    await deleteAccount('u1', 'pw');
    expect(revokeProviderAccessForUser).toHaveBeenCalledWith('u1');
    expect(order).toEqual(['revoke', 'delete']);
  });
});
