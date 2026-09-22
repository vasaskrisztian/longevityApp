import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';
import { InvalidOAuthStateError } from '@/modules/wearable/domain/errors';

const requireAuthenticatedUserMock = vi.fn();
function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedError || error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
vi.mock('@/lib/auth/authorization', () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock,
  toErrorResponse,
}));

const recordAuditLogMock = vi.fn();
vi.mock('@/lib/audit/audit-log.service', () => ({
  recordAuditLog: recordAuditLogMock,
}));

const loggerMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock('@/lib/logging/logger', () => ({ logger: loggerMock }));

const consumeOAuthStateMock = vi.fn();
vi.mock('@/modules/wearable/services/oauth-state.service', () => ({
  consumeOAuthState: consumeOAuthStateMock,
}));

const upsertConnectionAsConnectedMock = vi.fn();
vi.mock('@/modules/wearable/services/wearable.service', () => ({
  upsertConnectionAsConnected: upsertConnectionAsConnectedMock,
}));

const saveCredentialMock = vi.fn();
vi.mock('@/modules/wearable/services/credential-vault.service', () => ({
  saveCredential: saveCredentialMock,
}));

const enqueueInitialSyncJobMock = vi.fn();
vi.mock('@/modules/wearable/services/sync-job.service', () => ({
  enqueueInitialSyncJob: enqueueInitialSyncJobMock,
}));

const enqueueSyncJobToQueueMock = vi.fn();
vi.mock('@/lib/queue/queues', () => ({
  enqueueSyncJobToQueue: enqueueSyncJobToQueueMock,
}));

const exchangeAuthorizationCodeMock = vi.fn();
const getOuraProviderMock = vi.fn(() => ({
  id: 'OURA',
  exchangeAuthorizationCode: exchangeAuthorizationCodeMock,
}));
vi.mock('@/modules/wearable/providers/oura/oura-provider', () => ({
  getOuraProvider: getOuraProviderMock,
}));

const { GET } = await import('@/app/api/integrations/oura/callback/route');

const BASE_URL = 'https://app.example.com/api/integrations/oura/callback';

function requestWith(params: Record<string, string>): Request {
  const url = new URL(BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString());
}

const TOKEN_SET = {
  accessToken: 'at',
  accessTokenExpiresAt: new Date(Date.now() + 3600_000),
  refreshToken: 'rt',
  grantedScopes: ['personal', 'daily'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/integrations/oura/callback', () => {
  it('returns 401 and never touches OAuth state when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(requestWith({ code: 'c', state: 's' }));

    expect(response.status).toBe(401);
    expect(consumeOAuthStateMock).not.toHaveBeenCalled();
  });

  it('redirects with oura_error=denied when the user declined consent, without consuming state', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await GET(requestWith({ error: 'access_denied' }));

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/profile/devices');
    expect(location.searchParams.get('oura_error')).toBe('denied');
    expect(consumeOAuthStateMock).not.toHaveBeenCalled();
  });

  it('returns 400 when code or state is missing', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await GET(requestWith({ code: 'c' }));

    expect(response.status).toBe(400);
    expect(consumeOAuthStateMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the state is invalid or expired', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    consumeOAuthStateMock.mockRejectedValue(new InvalidOAuthStateError());

    const response = await GET(requestWith({ code: 'c', state: 'bad' }));

    expect(response.status).toBe(400);
    expect(exchangeAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('rethrows any error from consumeOAuthState that is not InvalidOAuthStateError', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const unexpected = new Error('db exploded');
    consumeOAuthStateMock.mockRejectedValue(unexpected);

    await expect(GET(requestWith({ code: 'c', state: 's' }))).rejects.toThrow(unexpected);
  });

  it('returns 400 when the consumed state belongs to a different user (defense-in-depth)', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    consumeOAuthStateMock.mockResolvedValue({
      userId: 'someone-else',
      redirectUri: BASE_URL,
      codeVerifier: 'v',
    });

    const response = await GET(requestWith({ code: 'c', state: 's' }));

    expect(response.status).toBe(400);
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'oura_state_user_mismatch',
      expect.objectContaining({ sessionUserId: 'u1', stateUserId: 'someone-else' }),
    );
    expect(exchangeAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the consumed state has no PKCE code verifier', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    consumeOAuthStateMock.mockResolvedValue({ userId: 'u1', redirectUri: BASE_URL, codeVerifier: null });

    const response = await GET(requestWith({ code: 'c', state: 's' }));

    expect(response.status).toBe(400);
    expect(exchangeAuthorizationCodeMock).not.toHaveBeenCalled();
  });

  it('redirects with oura_error=exchange_failed when the token exchange fails, and creates no connection', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    consumeOAuthStateMock.mockResolvedValue({ userId: 'u1', redirectUri: BASE_URL, codeVerifier: 'v' });
    exchangeAuthorizationCodeMock.mockRejectedValue(new Error('bad code'));

    const response = await GET(requestWith({ code: 'c', state: 's' }));

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(location.searchParams.get('oura_error')).toBe('exchange_failed');
    expect(upsertConnectionAsConnectedMock).not.toHaveBeenCalled();
    expect(enqueueSyncJobToQueueMock).not.toHaveBeenCalled();
  });

  it('on success: stores the connection, saves the credential, audit-logs, enqueues the initial sync, pushes it onto the queue, and redirects without an error param', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    consumeOAuthStateMock.mockResolvedValue({ userId: 'u1', redirectUri: BASE_URL, codeVerifier: 'v' });
    exchangeAuthorizationCodeMock.mockResolvedValue(TOKEN_SET);
    upsertConnectionAsConnectedMock.mockResolvedValue({ id: 'conn-1' });
    saveCredentialMock.mockResolvedValue(undefined);
    recordAuditLogMock.mockResolvedValue(undefined);
    enqueueInitialSyncJobMock.mockResolvedValue({ id: 'job-1' });

    const response = await GET(requestWith({ code: 'auth-code', state: 's' }));

    expect(upsertConnectionAsConnectedMock).toHaveBeenCalledWith({
      userId: 'u1',
      provider: 'OURA',
      grantedScopes: TOKEN_SET.grantedScopes,
    });
    expect(saveCredentialMock).toHaveBeenCalledWith('conn-1', TOKEN_SET);
    expect(recordAuditLogMock).toHaveBeenCalledWith({
      actorUserId: 'u1',
      targetUserId: 'u1',
      action: 'USER_CONNECT_OURA',
      entityType: 'WearableConnection',
      entityId: 'conn-1',
    });
    expect(enqueueInitialSyncJobMock).toHaveBeenCalledWith({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
    });
    expect(enqueueSyncJobToQueueMock).toHaveBeenCalledWith('INITIAL', 'job-1');
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/profile/devices');
    expect(location.searchParams.get('oura_error')).toBeNull();
  });
});
