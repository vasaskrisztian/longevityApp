import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { logger } from '@/lib/logging/logger';
import { recordAuditLog } from '@/lib/audit/audit-log.service';
import { consumeOAuthState } from '@/modules/wearable/services/oauth-state.service';
import {
  upsertConnectionAsConnected,
} from '@/modules/wearable/services/wearable.service';
import { saveCredential } from '@/modules/wearable/services/credential-vault.service';
import { enqueueInitialSyncJob } from '@/modules/wearable/services/sync-job.service';
import { enqueueSyncJobToQueue } from '@/lib/queue/queues';
import { getOuraProvider } from '@/modules/wearable/providers/oura/oura-provider';
import { InvalidOAuthStateError } from '@/modules/wearable/domain/errors';

function redirectToDevices(request: Request, ouraError?: string): Response {
  const url = new URL('/profile/devices', request.url);
  if (ouraError) {
    url.searchParams.set('oura_error', ouraError);
  }
  return Response.redirect(url, 302);
}

/**
 * ARCHITECTURE.md §5, steps 2-3: validate the single-use state, exchange the
 * code for tokens, encrypt and store them, record the connection, enqueue
 * the initial sync (bookkeeping only — Phase 7 builds the worker that
 * processes it), and audit-log the connect event.
 */
export async function GET(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const url = new URL(request.url);
  const errorParam = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const provider = getOuraProvider();

  if (errorParam) {
    logger.warn('oura_consent_denied', { userId, error: errorParam });
    return redirectToDevices(request, 'denied');
  }

  if (!code || !state) {
    return Response.json({ error: 'Missing code or state parameter' }, { status: 400 });
  }

  let consumed;
  try {
    consumed = await consumeOAuthState(state, provider.id);
  } catch (error) {
    if (error instanceof InvalidOAuthStateError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  // Defense-in-depth beyond "the state row exists": it must belong to the
  // session presenting it (ARCHITECTURE.md §5: "state bound to the user's
  // session"), not merely be valid in isolation — otherwise a state minted
  // for user A, if somehow captured, could be replayed by user B before
  // its 10-minute TTL expires.
  if (consumed.userId !== userId) {
    logger.warn('oura_state_user_mismatch', { sessionUserId: userId, stateUserId: consumed.userId });
    return Response.json({ error: 'Invalid or expired OAuth state' }, { status: 400 });
  }

  if (!consumed.codeVerifier) {
    // Can't happen via connect/route.ts (it always sets codeVerifier), but
    // keeps this from silently calling exchangeAuthorizationCode with an
    // empty string if the row was ever created some other way.
    return Response.json({ error: 'Invalid OAuth state (missing PKCE verifier)' }, { status: 400 });
  }

  let tokenSet;
  try {
    tokenSet = await provider.exchangeAuthorizationCode({ code, codeVerifier: consumed.codeVerifier });
  } catch (error) {
    logger.error('oura_token_exchange_failed', { userId, message: (error as Error).message });
    return redirectToDevices(request, 'exchange_failed');
  }

  const { id: connectionId } = await upsertConnectionAsConnected({
    userId,
    provider: provider.id,
    grantedScopes: tokenSet.grantedScopes,
  });
  await saveCredential(connectionId, tokenSet);

  await recordAuditLog({
    actorUserId: userId,
    targetUserId: userId,
    action: 'USER_CONNECT_OURA',
    entityType: 'WearableConnection',
    entityId: connectionId,
  });

  // ARCHITECTURE.md §5: "does not wait for the historical import" — this
  // awaits only the DB row + the (fire-and-forget-fast) queue push, never
  // the sync itself. Phase 7 built the worker/queue that actually consumes
  // this; before that, the row was created but nothing ever processed it.
  const { id: jobId } = await enqueueInitialSyncJob({ userId, connectionId, provider: provider.id });
  await enqueueSyncJobToQueue('INITIAL', jobId);

  return redirectToDevices(request);
}
