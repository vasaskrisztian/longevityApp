import { prisma } from '@/lib/db/prisma';
import { getEncryptionService } from '@/lib/encryption/encryption.service';
import type { OAuthTokenSet } from '../domain/wearable-provider.types';

/**
 * The ONLY place OAuth tokens are ever encrypted, decrypted, or persisted.
 * Callers (Phase 4's connect/callback/refresh routes) pass plaintext tokens
 * in and get plaintext tokens back; ciphertext/iv/authTag never leave this
 * module. Nothing here knows which provider it's storing credentials for —
 * that's `WearableConnection.provider`'s job, one layer up.
 *
 * `getEncryptionService()` throws if TOKEN_ENCRYPTION_KEY is missing/invalid
 * (see lib/encryption/encryption.service.ts) — that's intentional: a
 * misconfigured deployment should fail loudly here rather than silently
 * storing something it can't decrypt later.
 */

export interface DecryptedCredential {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshVersion: number;
}

export async function saveCredential(
  connectionId: string,
  tokens: OAuthTokenSet,
): Promise<void> {
  const encryption = getEncryptionService();
  const [accessToken, refreshToken] = await Promise.all([
    encryption.encrypt(tokens.accessToken),
    encryption.encrypt(tokens.refreshToken),
  ]);

  await prisma.encryptedCredential.upsert({
    where: { connectionId },
    create: {
      connectionId,
      accessTokenCipher: accessToken.ciphertext,
      accessTokenIv: accessToken.iv,
      accessTokenAuthTag: accessToken.authTag,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenCipher: refreshToken.ciphertext,
      refreshTokenIv: refreshToken.iv,
      refreshTokenAuthTag: refreshToken.authTag,
      refreshVersion: 0,
    },
    update: {
      // Deliberately omits refreshVersion: the rotating-refresh flow
      // (ARCHITECTURE.md §6, Phase 4) is the only code path allowed to bump
      // it, and it does so with an optimistic-concurrency-checked update of
      // its own — not via this generic save.
      accessTokenCipher: accessToken.ciphertext,
      accessTokenIv: accessToken.iv,
      accessTokenAuthTag: accessToken.authTag,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenCipher: refreshToken.ciphertext,
      refreshTokenIv: refreshToken.iv,
      refreshTokenAuthTag: refreshToken.authTag,
    },
  });
}

export async function loadCredential(
  connectionId: string,
): Promise<DecryptedCredential | null> {
  const row = await prisma.encryptedCredential.findUnique({ where: { connectionId } });
  if (!row) {
    return null;
  }

  const encryption = getEncryptionService();
  const [accessToken, refreshToken] = await Promise.all([
    encryption.decrypt({
      ciphertext: row.accessTokenCipher,
      iv: row.accessTokenIv,
      authTag: row.accessTokenAuthTag,
    }),
    encryption.decrypt({
      ciphertext: row.refreshTokenCipher,
      iv: row.refreshTokenIv,
      authTag: row.refreshTokenAuthTag,
    }),
  ]);

  return {
    accessToken,
    accessTokenExpiresAt: row.accessTokenExpiresAt,
    refreshToken,
    refreshVersion: row.refreshVersion,
  };
}

export async function deleteCredential(connectionId: string): Promise<void> {
  await prisma.encryptedCredential.deleteMany({ where: { connectionId } });
}

/**
 * The ONLY function allowed to bump refreshVersion — used exclusively by
 * modules/wearable/services/refresh-credential.service.ts's rotating-refresh
 * flow (ARCHITECTURE.md §6), which already holds the advisory lock
 * (credential-lock.ts) by the time this is called. `expectedRefreshVersion`
 * is a belt-and-suspenders optimistic-concurrency check on top of that lock:
 * the `updateMany` only matches (and only then increments) if the row is
 * still at the version we last read it at. Returns false instead of
 * throwing so the caller — which already holds the lock and knows this
 * "shouldn't happen" — can decide how to react (see
 * CredentialVersionConflictError in refresh-credential.service.ts).
 */
export async function rotateCredential(
  connectionId: string,
  tokens: OAuthTokenSet,
  expectedRefreshVersion: number,
): Promise<boolean> {
  const encryption = getEncryptionService();
  const [accessToken, refreshToken] = await Promise.all([
    encryption.encrypt(tokens.accessToken),
    encryption.encrypt(tokens.refreshToken),
  ]);

  const result = await prisma.encryptedCredential.updateMany({
    where: { connectionId, refreshVersion: expectedRefreshVersion },
    data: {
      accessTokenCipher: accessToken.ciphertext,
      accessTokenIv: accessToken.iv,
      accessTokenAuthTag: accessToken.authTag,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenCipher: refreshToken.ciphertext,
      refreshTokenIv: refreshToken.iv,
      refreshTokenAuthTag: refreshToken.authTag,
      refreshVersion: { increment: 1 },
    },
  });

  return result.count === 1;
}
