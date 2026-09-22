import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';
import { ProviderNotConfiguredError } from '@/modules/wearable/domain/errors';

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

const generatePkcePairMock = vi.fn();
vi.mock('@/lib/auth/pkce', () => ({ generatePkcePair: generatePkcePairMock }));

const checkRateLimitMock = vi.fn();
vi.mock('@/lib/auth/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
  AUTH_RATE_LIMIT: { windowMs: 15 * 60 * 1000, max: 5 },
}));

const createOAuthStateMock = vi.fn();
vi.mock('@/modules/wearable/services/oauth-state.service', () => ({
  createOAuthState: createOAuthStateMock,
}));

const getRedirectUriMock = vi.fn();
const buildAuthorizationUrlMock = vi.fn();
const getOuraProviderMock = vi.fn(() => ({
  id: 'OURA',
  getRedirectUri: getRedirectUriMock,
  buildAuthorizationUrl: buildAuthorizationUrlMock,
}));
vi.mock('@/modules/wearable/providers/oura/oura-provider', () => ({
  getOuraProvider: getOuraProviderMock,
}));

const { GET } = await import('@/app/api/integrations/oura/connect/route');

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 900_000 });
  getRedirectUriMock.mockReturnValue('https://app.example.com/api/integrations/oura/callback');
  generatePkcePairMock.mockReturnValue({
    codeVerifier: 'verifier',
    codeChallenge: 'challenge',
    codeChallengeMethod: 'S256',
  });
  createOAuthStateMock.mockResolvedValue({ state: 'state-abc', expiresAt: new Date() });
  buildAuthorizationUrlMock.mockReturnValue('https://cloud.ouraring.com/oauth/authorize?state=state-abc');
});

describe('GET /api/integrations/oura/connect', () => {
  it('returns 401 and never touches OAuth state or the provider when unauthenticated', async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET();

    expect(response.status).toBe(401);
    expect(createOAuthStateMock).not.toHaveBeenCalled();
  });

  it('rate-limits per caller — Phase 9: ARCHITECTURE.md §4.3 lists this endpoint alongside login/register/password-reset', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    await GET();

    expect(checkRateLimitMock).toHaveBeenCalledWith('oura-connect', 'u1', {
      windowMs: 900_000,
      max: 5,
    });
  });

  it('returns 429 and never touches OAuth state or the provider when the rate limit is exceeded', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    checkRateLimitMock.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const response = await GET();

    expect(response.status).toBe(429);
    expect(createOAuthStateMock).not.toHaveBeenCalled();
    expect(getOuraProviderMock).not.toHaveBeenCalled();
  });

  it('returns 503 when the provider is not configured', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    getRedirectUriMock.mockImplementation(() => {
      throw new ProviderNotConfiguredError('OURA');
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(createOAuthStateMock).not.toHaveBeenCalled();
  });

  it('rethrows any error from getRedirectUri that is not ProviderNotConfiguredError', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });
    const unexpected = new Error('boom');
    getRedirectUriMock.mockImplementation(() => {
      throw unexpected;
    });

    await expect(GET()).rejects.toThrow(unexpected);
  });

  it('generates PKCE, persists OAuth state bound to the caller, and redirects to the authorization URL', async () => {
    requireAuthenticatedUserMock.mockResolvedValue({ id: 'u1', role: 'USER' });

    const response = await GET();

    expect(createOAuthStateMock).toHaveBeenCalledWith({
      userId: 'u1',
      provider: 'OURA',
      redirectUri: 'https://app.example.com/api/integrations/oura/callback',
      codeVerifier: 'verifier',
    });
    expect(buildAuthorizationUrlMock).toHaveBeenCalledWith({
      state: 'state-abc',
      codeChallenge: 'challenge',
    });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://cloud.ouraring.com/oauth/authorize?state=state-abc',
    );
  });
});
