import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { resolveAppUrl } from '@/lib/http/app-url';
import { logger } from '@/lib/logging/logger';
import { recordAuditLog } from '@/lib/audit/audit-log.service';
import {
  getConnectionForUserAndProvider,
  markConnectionDisconnected,
} from '@/modules/wearable/services/wearable.service';
import { loadCredential, deleteCredential } from '@/modules/wearable/services/credential-vault.service';
import { getOuraProvider } from '@/modules/wearable/providers/oura/oura-provider';

/**
 * No `[id]` in this route — the connection is resolved from (the caller's
 * own userId, OURA), never from a client-supplied id, so there is no IDOR
 * surface here to test (same reasoning as Phase 3's GET /api/wearables).
 * POST (not DELETE) so a plain HTML <form method="POST"> works without any
 * client-side JS; responds 303 so the browser's follow-up request is a GET.
 */
export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const provider = getOuraProvider();
  const connection = await getConnectionForUserAndProvider(userId, provider.id);

  if (connection.id && connection.status !== 'DISCONNECTED') {
    const credential = await loadCredential(connection.id);
    if (credential) {
      try {
        // Best-effort — oura-auth.ts's revokeOuraTokens already swallows its
        // own network/HTTP failures, but a defensive catch here means even a
        // future provider that doesn't honor that contract can never block
        // local revocation, which is what actually protects the user.
        await provider.revokeTokens({ accessToken: credential.accessToken });
      } catch (error) {
        logger.warn('provider_revoke_threw_unexpectedly', {
          provider: provider.id,
          message: (error as Error).message,
        });
      }
    }

    await deleteCredential(connection.id);
    await markConnectionDisconnected(connection.id);

    await recordAuditLog({
      actorUserId: userId,
      targetUserId: userId,
      action: 'USER_DISCONNECT_OURA',
      entityType: 'WearableConnection',
      entityId: connection.id,
    });
  }

  return Response.redirect(resolveAppUrl('/profile/devices', request.url), 303);
}
