import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logging/logger';
import { loadCredential } from './credential-vault.service';
import { getOuraProvider } from '../providers/oura/oura-provider';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Best-effort revocation of a person's access tokens at the wearable
 * providers (used when an account is deleted, before its stored credentials
 * disappear with it). Never throws and never blocks the caller: the
 * credentials are removed locally either way, which is what actually
 * protects the user.
 */
export async function revokeProviderAccessForUser(userId: string): Promise<void> {
  try {
    const connection: any = await prisma.wearableConnection.findFirst({
      where: { userId, provider: 'OURA', status: { not: 'DISCONNECTED' } },
      select: { id: true },
    });
    if (!connection) return;
    const credential = await loadCredential(connection.id);
    if (!credential) return;
    await getOuraProvider().revokeTokens({ accessToken: credential.accessToken });
  } catch (error) {
    logger.warn('provider_revoke_failed', { message: (error as Error).message });
  }
}
