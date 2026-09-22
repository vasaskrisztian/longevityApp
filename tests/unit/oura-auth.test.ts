import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const loggerMock = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock('@/lib/logging/logger', () => ({ logger: loggerMock }));

// Dynamic import (not a static one) so it runs after `loggerMock` above has
// been initialized — vi.mock's factory is hoisted above the top of the file,
// but a static `import` is hoisted with it, which would reference
// `loggerMock` before its `const` initializer runs (TDZ).
const {
  buildOuraAuthorizeUrl,
  exchangeOuraAuthorizationCode,
  refreshOuraAccessToken,
  revokeOuraTokens,
} = await import('@/modules/wearable/providers/oura/oura-auth');
const { ProviderTokenExchangeError } = await import('@/modules/wearable/domain/errors');

const ENV_KEYS = ['OURA_CLIENT_ID', 'OURA_CLIENT_SECRET', 'OURA_REDIRECT_URI'] as const;
const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    original[key] = process.env[key];
  }
  process.env.OURA_CLIENT_ID = 'test-client-id';
  process.env.OURA_CLIENT_SECRET = 'test-client-secret';
  process.env.OURA_REDIRECT_URI = 'https://app.example.com/api/integrations/oura/callback';
  vi.clearAllMocks();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  vi.unstubAllGlobals();
});

describe('buildOuraAuthorizeUrl', () => {
  it('builds a well-formed Oura authorize URL with PKCE and the requested scopes', () => {
    const url = new URL(
      buildOuraAuthorizeUrl({ state: 'state-abc', codeChallenge: 'challenge-xyz' }),
    );

    expect(url.origin + url.pathname).toBe('https://cloud.ouraring.com/oauth/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.example.com/api/integrations/oura/callback',
    );
    expect(url.searchParams.get('state')).toBe('state-abc');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-xyz');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('personal daily heartrate workout spo2Daily');
  });
});

describe('exchangeOuraAuthorizationCode', () => {
  it('posts the authorization_code grant and returns the parsed token response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'at',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'rt',
        scope: 'personal daily',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await exchangeOuraAuthorizationCode({ code: 'auth-code', codeVerifier: 'verifier' });

    expect(result.access_token).toBe('at');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.ouraring.com/oauth/token');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('code_verifier')).toBe('verifier');
    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('client_secret')).toBe('test-client-secret');
    expect(body.get('redirect_uri')).toBe('https://app.example.com/api/integrations/oura/callback');
  });

  it('throws ProviderTokenExchangeError on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'invalid_grant' }),
    );

    await expect(
      exchangeOuraAuthorizationCode({ code: 'bad-code', codeVerifier: 'verifier' }),
    ).rejects.toThrow(ProviderTokenExchangeError);
  });
});

describe('refreshOuraAccessToken', () => {
  it('posts the refresh_token grant', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-at',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'new-rt',
        scope: 'personal',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await refreshOuraAccessToken({ refreshToken: 'old-rt' });

    expect(result.access_token).toBe('new-at');
    const [, init] = fetchMock.mock.calls[0]!;
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('old-rt');
  });
});

describe('revokeOuraTokens', () => {
  it('never throws on a network failure — logs a warning and returns', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(revokeOuraTokens({ accessToken: 'at' })).resolves.toBeUndefined();
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'oura_revoke_request_failed',
      expect.objectContaining({ message: 'network down' }),
    );
  });

  it('never throws on a non-ok response — logs a warning and returns', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(revokeOuraTokens({ accessToken: 'at' })).resolves.toBeUndefined();
    expect(loggerMock.warn).toHaveBeenCalledWith('oura_revoke_non_ok_response', { status: 500 });
  });

  it('returns immediately without calling fetch when Oura is not configured', async () => {
    delete process.env.OURA_CLIENT_ID;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(revokeOuraTokens({ accessToken: 'at' })).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the token to revoke on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await revokeOuraTokens({ accessToken: 'at-to-revoke' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.ouraring.com/oauth/revoke');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('token')).toBe('at-to-revoke');
  });
});
