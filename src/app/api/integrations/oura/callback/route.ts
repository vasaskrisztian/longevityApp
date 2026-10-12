import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { UnauthenticatedError } from '@/lib/auth/errors';
import { resolveWebAppUrl } from '@/lib/http/app-url';
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

type Outcome = 'connected' | 'denied' | 'exchange_failed';

const OUTCOME_TEXT: Record<Outcome, { title: string; body: string }> = {
  connected: {
    title: 'Oura connected',
    body: 'Your Oura Ring is connected and the first sync has started. You can close this window and go back to the app.',
  },
  denied: {
    title: 'Oura was not connected',
    body: 'You did not allow access, so nothing was connected. You can close this window and try again from the app.',
  },
  exchange_failed: {
    title: 'Connecting Oura failed',
    body: 'Oura did not accept the connection. You can close this window and try again from the app.',
  },
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The browser that lands here is the system/in-app browser the Oura consent
 * screen ran in (or a new tab on web) — a separate context from the app, with
 * no login of its own. So the result is a small self-contained page, not a
 * redirect into the app (which would show a sign-in screen there); the app
 * refreshes its device status when the person returns to it.
 */
function resultPage(request: Request, outcome: Outcome): Response {
  const { title, body } = OUTCOME_TEXT[outcome];
  const appUrl = escapeHtml(resolveWebAppUrl('/me/devices', request.url).toString());
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,sans-serif;background:#faf8f3;color:#1c1c1c;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}main{max-width:420px;text-align:center}h1{font-size:22px;margin:0 0 12px}p{color:#5b5b5b;line-height:1.5}a{display:inline-block;margin-top:16px;color:#2f4a3a}</style></head><body><main><h1>${title}</h1><p>${body}</p><a href="${appUrl}">Open Longevity Klub</a></main></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/**
 * ARCHITECTURE.md §5, steps 2-3: validate the single-use state, exchange the
 * code for tokens, encrypt and store them, record the connection, enqueue
 * the initial sync (bookkeeping only — Phase 7 builds the worker that
 * processes it), and audit-log the connect event.
 */
export async function GET(request: Request) {
  // There is usually NO session here: the Expo app (mobile and web) signs in
  // with Bearer tokens, which a browser redirect from Oura cannot carry. The
  // person is identified by the single-use, short-lived, random `state` that
  // an authenticated caller created in connect/route.ts (it stores the userId
  // and the PKCE verifier) — the standard way to finish OAuth for native
  // apps. If a session cookie does happen to be present it must agree.
  let sessionUserId: string | null = null;
  try {
    sessionUserId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    if (!(error instanceof UnauthenticatedError)) return toErrorResponse(error);
  }

  const url = new URL(request.url);
  const errorParam = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const provider = getOuraProvider();

  if (errorParam) {
    logger.warn('oura_consent_denied', { userId: sessionUserId, error: errorParam });
    return resultPage(request, 'denied');
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

  // Defense-in-depth beyond "the state row exists": when a session cookie is
  // present it must belong to the same user as the state (ARCHITECTURE.md §5),
  // so a state minted for user A cannot be replayed by a signed-in user B
  // within its 10-minute TTL. Without a session the state alone identifies
  // the person (see the comment at the top of GET); that is safe because the
  // account that gets connected is always the one that started the flow.
  if (sessionUserId && consumed.userId !== sessionUserId) {
    logger.warn('oura_state_user_mismatch', { sessionUserId, stateUserId: consumed.userId });
    return Response.json({ error: 'Invalid or expired OAuth state' }, { status: 400 });
  }
  const userId = consumed.userId;

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
    return resultPage(request, 'exchange_failed');
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

  return resultPage(request, 'connected');
}
