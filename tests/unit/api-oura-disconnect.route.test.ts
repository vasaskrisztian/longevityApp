import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';

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

const getConnectionForUserAndProviderMock = vi.fn();
const markConnectionDisconnectedMock = vi.fn();
vi.mock('@/modules/wearable/services/wearable.service', () => ({
  getConnectionForUserAndProvider: getConnectionForUserAndProviderMock,
  markConnectionDisconnected: markConnectionDisconnectedMock,
}));

const loadCredentialMock = vi.fn();
const deleteCredentialMock = vi.fn();
vi.mock('@/modules/wearable/services/credential-vault.service', () => ({
  loadCredential: loadCredentialMock,
  deleteCredential: deleteCredentialMock,
}));

const revokeTokensMock = vi.fn();
const getOuraProviderMock = vi.fn(() => ({
  id: 'OURA',
  revokeTokens: revokeTokensMock,
}));
vi.mock('@/modules/wearable/providers/oura/oura-provider', () => ({
  getOuraProvider: getOuraProviderMock,
}));

const { POST } = await import('@/app/api/integrations/oura/disconnect/route');

const REQUEST = new Request('https://app.example.com/api/integrations/oura/disconnect', {
  method: 'POST',
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/integrations/oura/disconnect', () => {
  it('returns 401 and never touches the connection when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST(REQUEST);

    expect(response.status).toBe(401);
    expect(getConnectionForUserAndProviderMock).not.toHaveBeenCalled();
  });

  it('is a no-op that still redirects when the provider was never connected', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: null, status: 'DISCONNECTED' });

    const response = await POST(REQUEST);

    expect(response.status).toBe(303);
    expect(loadCredentialMock).not.toHaveBeenCalled();
    expect(deleteCredentialMock).not.toHaveBeenCalled();
    expect(markConnectionDisconnectedMock).not.toHaveBeenCalled();
    expect(recordAuditLogMock).not.toHaveBeenCalled();
  });

  it('is a no-op when the connection row exists but is already DISCONNECTED', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: 'conn-1', status: 'DISCONNECTED' });

    await POST(REQUEST);

    expect(loadCredentialMock).not.toHaveBeenCalled();
    expect(markConnectionDisconnectedMock).not.toHaveBeenCalled();
  });

  it('scopes the lookup to the caller\'s own userId and OURA — no client-suppliable connection id', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: null, status: 'DISCONNECTED' });

    await POST(REQUEST);

    expect(getConnectionForUserAndProviderMock).toHaveBeenCalledWith('u1', 'OURA');
  });

  it('on a connected provider: revokes, deletes the credential, marks disconnected, and audit-logs before redirecting 303', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: 'conn-1', status: 'CONNECTED' });
    loadCredentialMock.mockResolvedValue({
      accessToken: 'at',
      accessTokenExpiresAt: new Date(),
      refreshToken: 'rt',
      refreshVersion: 0,
    });
    revokeTokensMock.mockResolvedValue(undefined);
    deleteCredentialMock.mockResolvedValue(undefined);
    markConnectionDisconnectedMock.mockResolvedValue(undefined);
    recordAuditLogMock.mockResolvedValue(undefined);

    const response = await POST(REQUEST);

    expect(revokeTokensMock).toHaveBeenCalledWith({ accessToken: 'at' });
    expect(deleteCredentialMock).toHaveBeenCalledWith('conn-1');
    expect(markConnectionDisconnectedMock).toHaveBeenCalledWith('conn-1');
    expect(recordAuditLogMock).toHaveBeenCalledWith({
      actorUserId: 'u1',
      targetUserId: 'u1',
      action: 'USER_DISCONNECT_OURA',
      entityType: 'WearableConnection',
      entityId: 'conn-1',
    });
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/profile/devices');
  });

  it('still deletes the local credential and marks disconnected even if the provider revoke call throws unexpectedly', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: 'conn-1', status: 'AUTH_REQUIRED' });
    loadCredentialMock.mockResolvedValue({
      accessToken: 'at',
      accessTokenExpiresAt: new Date(),
      refreshToken: 'rt',
      refreshVersion: 0,
    });
    revokeTokensMock.mockRejectedValue(new Error('unexpected throw'));

    const response = await POST(REQUEST);

    expect(loggerMock.warn).toHaveBeenCalledWith(
      'provider_revoke_threw_unexpectedly',
      expect.objectContaining({ provider: 'OURA' }),
    );
    expect(deleteCredentialMock).toHaveBeenCalledWith('conn-1');
    expect(markConnectionDisconnectedMock).toHaveBeenCalledWith('conn-1');
    expect(response.status).toBe(303);
  });

  it('skips provider revoke but still marks disconnected when no credential row exists locally', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getConnectionForUserAndProviderMock.mockResolvedValue({ id: 'conn-1', status: 'CONNECTED' });
    loadCredentialMock.mockResolvedValue(null);

    await POST(REQUEST);

    expect(revokeTokensMock).not.toHaveBeenCalled();
    expect(deleteCredentialMock).toHaveBeenCalledWith('conn-1');
    expect(markConnectionDisconnectedMock).toHaveBeenCalledWith('conn-1');
  });
});
