import { prisma } from '@/lib/db/prisma';
import { recordAuditLog } from '@/lib/audit/audit-log.service';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { logger } from '@/lib/logging/logger';
import { revokeProviderAccessForUser } from '@/modules/wearable/services/provider-access.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ChangePasswordResult = 'ok' | 'wrong_password' | 'unavailable';

/**
 * Changes the signed-in user's password after re-checking the current one.
 * All mobile refresh tokens are revoked, so every other device has to sign in
 * again with the new password (the app signs this device out as well). The web
 * session cookie is a stateless JWT and cannot be revoked server-side — it
 * simply expires on its own.
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  const user: any = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash) return 'unavailable';
  if (!(await verifyPassword(user.passwordHash, currentPassword))) return 'wrong_password';

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.mobileRefreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  logger.info('password_changed', { userId });
  await recordAuditLog({ actorUserId: userId, targetUserId: userId, action: 'USER_CHANGE_PASSWORD' });
  return 'ok';
}

export type DeleteAccountResult = 'ok' | 'wrong_password' | 'admin_account' | 'unavailable';

/**
 * Permanently deletes the signed-in user's account and everything tied to it
 * (profile, health data, supplements, goals, protocols, challenges, InBody
 * results, device connections, group memberships and challenge participation —
 * the schema cascades). Refused for administrators: they own groups and
 * challenges (restricted relations) and an admin must be demoted, with their
 * groups handed over, first. Provider tokens (Oura) are revoked on a best-effort
 * basis before the credentials disappear.
 */
export async function deleteAccount(userId: string, password: string): Promise<DeleteAccountResult> {
  const user: any = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, role: true } });
  if (!user?.passwordHash) return 'unavailable';
  if (!(await verifyPassword(user.passwordHash, password))) return 'wrong_password';
  if (user.role === 'ADMIN') return 'admin_account';

  await revokeProviderAccessForUser(userId);

  // Logged first: the row survives the deletion with its actor/target set to null.
  await recordAuditLog({ actorUserId: userId, targetUserId: userId, action: 'USER_DELETE_ACCOUNT' });
  await prisma.user.delete({ where: { id: userId } });
  logger.info('account_deleted', { userId });
  return 'ok';
}
