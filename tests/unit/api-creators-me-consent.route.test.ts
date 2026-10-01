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

const setPublicProfileConsentMock = vi.fn();
const revokePublicProfileConsentMock = vi.fn();
class NotACreatorError extends Error {}
vi.mock('@/modules/creators/creators.service', () => ({
  setPublicProfileConsent: setPublicProfileConsentMock,
  revokePublicProfileConsent: revokePublicProfileConsentMock,
  NotACreatorError,
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { PATCH } = await import('@/app/api/creators/me/consent/route');

function patchRequest(body: unknown): Request {
  return new Request('https://example.com', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/creators/me/consent', () => {
  it('returns 401 when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await PATCH(patchRequest({ consent: true }));

    expect(response.status).toBe(401);
    expect(setPublicProfileConsentMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-boolean consent value', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await PATCH(patchRequest({ consent: 'yes' }));

    expect(response.status).toBe(400);
  });

  it('enables consent and returns 200', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    setPublicProfileConsentMock.mockResolvedValue(undefined);

    const response = await PATCH(patchRequest({ consent: true }));

    expect(setPublicProfileConsentMock).toHaveBeenCalledWith('u1');
    expect(response.status).toBe(200);
  });

  it('revokes consent and returns 200', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    revokePublicProfileConsentMock.mockResolvedValue(undefined);

    const response = await PATCH(patchRequest({ consent: false }));

    expect(revokePublicProfileConsentMock).toHaveBeenCalledWith('u1');
    expect(response.status).toBe(200);
  });

  it('returns 403 when the account is not a CREATOR yet', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    setPublicProfileConsentMock.mockRejectedValue(new NotACreatorError('Only CREATOR accounts can enable a public profile'));

    const response = await PATCH(patchRequest({ consent: true }));

    expect(response.status).toBe(403);
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    setPublicProfileConsentMock.mockRejectedValue(new Error('db down'));

    const response = await PATCH(patchRequest({ consent: true }));

    expect(response.status).toBe(500);
  });
});
