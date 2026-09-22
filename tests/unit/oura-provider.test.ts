import { describe, it, expect, vi, beforeEach } from 'vitest';

const isOuraMockModeMock = vi.fn();
const loadOuraCredentialsMock = vi.fn();
vi.mock('@/modules/wearable/providers/oura/oura-config', () => ({
  isOuraMockMode: isOuraMockModeMock,
  loadOuraCredentials: loadOuraCredentialsMock,
}));

const buildOuraAuthorizeUrlMock = vi.fn();
const exchangeOuraAuthorizationCodeMock = vi.fn();
const refreshOuraAccessTokenMock = vi.fn();
const revokeOuraTokensMock = vi.fn();
vi.mock('@/modules/wearable/providers/oura/oura-auth', () => ({
  buildOuraAuthorizeUrl: buildOuraAuthorizeUrlMock,
  exchangeOuraAuthorizationCode: exchangeOuraAuthorizationCodeMock,
  refreshOuraAccessToken: refreshOuraAccessTokenMock,
  revokeOuraTokens: revokeOuraTokensMock,
}));

const mockExchangeAuthorizationCodeMock = vi.fn();
const mockRefreshAccessTokenMock = vi.fn();
const mockRevokeTokensMock = vi.fn();
vi.mock('@/modules/wearable/providers/oura/oura-mock', () => ({
  mockExchangeAuthorizationCode: mockExchangeAuthorizationCodeMock,
  mockRefreshAccessToken: mockRefreshAccessTokenMock,
  mockRevokeTokens: mockRevokeTokensMock,
}));

const fetchOuraDailySleepMock = vi.fn();
const fetchOuraDailyReadinessMock = vi.fn();
const fetchOuraDailyActivityMock = vi.fn();
const fetchOuraHeartRateMock = vi.fn();
const fetchOuraWorkoutsMock = vi.fn();
const fetchOuraDailySpo2Mock = vi.fn();
vi.mock('@/modules/wearable/providers/oura/oura-api-client', () => ({
  fetchOuraDailySleep: fetchOuraDailySleepMock,
  fetchOuraDailyReadiness: fetchOuraDailyReadinessMock,
  fetchOuraDailyActivity: fetchOuraDailyActivityMock,
  fetchOuraHeartRate: fetchOuraHeartRateMock,
  fetchOuraWorkouts: fetchOuraWorkoutsMock,
  fetchOuraDailySpo2: fetchOuraDailySpo2Mock,
}));

const mockFetchRawDataMock = vi.fn();
vi.mock('@/modules/wearable/providers/oura/oura-ingestion-mock', () => ({
  mockFetchRawData: mockFetchRawDataMock,
}));

const mapOuraRecordToDailyMetricMock = vi.fn();
const mapOuraRecordToWorkoutMock = vi.fn();
vi.mock('@/modules/wearable/providers/oura/oura-mappers', () => ({
  mapOuraRecordToDailyMetric: mapOuraRecordToDailyMetricMock,
  mapOuraRecordToWorkout: mapOuraRecordToWorkoutMock,
}));

const { OuraProvider, getOuraProvider, _resetOuraProviderForTests } = await import(
  '@/modules/wearable/providers/oura/oura-provider'
);
const { getProvider, _resetRegistryForTests } = await import(
  '@/modules/wearable/domain/provider-registry'
);

const OURA_TOKEN_RESPONSE = {
  access_token: 'at',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'rt',
  scope: 'personal daily',
};

beforeEach(() => {
  vi.clearAllMocks();
  _resetOuraProviderForTests();
  _resetRegistryForTests();
  loadOuraCredentialsMock.mockReturnValue({
    clientId: 'id',
    clientSecret: 'secret',
    redirectUri: 'https://app.example.com/api/integrations/oura/callback',
  });
});

describe('OuraProvider#getRedirectUri', () => {
  it('returns loadOuraCredentials().redirectUri', () => {
    const provider = new OuraProvider();
    expect(provider.getRedirectUri()).toBe('https://app.example.com/api/integrations/oura/callback');
  });
});

describe('OuraProvider#buildAuthorizationUrl', () => {
  it('delegates to buildOuraAuthorizeUrl in real mode', () => {
    isOuraMockModeMock.mockReturnValue(false);
    buildOuraAuthorizeUrlMock.mockReturnValue('https://cloud.ouraring.com/oauth/authorize?real=1');
    const provider = new OuraProvider();

    const url = provider.buildAuthorizationUrl({ state: 's', codeChallenge: 'c' });

    expect(url).toBe('https://cloud.ouraring.com/oauth/authorize?real=1');
    expect(buildOuraAuthorizeUrlMock).toHaveBeenCalledWith({ state: 's', codeChallenge: 'c' });
  });

  it('builds a marker URL against its own redirect URI in mock mode, without calling the real builder', () => {
    isOuraMockModeMock.mockReturnValue(true);
    const provider = new OuraProvider();

    const url = new URL(provider.buildAuthorizationUrl({ state: 'mock-state', codeChallenge: 'c' }));

    expect(url.origin + url.pathname).toBe('https://app.example.com/api/integrations/oura/callback');
    expect(url.searchParams.get('mock')).toBe('1');
    expect(url.searchParams.get('state')).toBe('mock-state');
    expect(buildOuraAuthorizeUrlMock).not.toHaveBeenCalled();
  });
});

describe('OuraProvider#exchangeAuthorizationCode', () => {
  it('uses the mock exchange in mock mode and maps the response to OAuthTokenSet', async () => {
    isOuraMockModeMock.mockReturnValue(true);
    mockExchangeAuthorizationCodeMock.mockResolvedValue(OURA_TOKEN_RESPONSE);
    const provider = new OuraProvider();

    const result = await provider.exchangeAuthorizationCode({ code: 'c', codeVerifier: 'v' });

    expect(exchangeOuraAuthorizationCodeMock).not.toHaveBeenCalled();
    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
    expect(result.grantedScopes).toEqual(['personal', 'daily']);
    expect(result.accessTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('uses the real exchange when mock mode is off', async () => {
    isOuraMockModeMock.mockReturnValue(false);
    exchangeOuraAuthorizationCodeMock.mockResolvedValue(OURA_TOKEN_RESPONSE);
    const provider = new OuraProvider();

    await provider.exchangeAuthorizationCode({ code: 'c', codeVerifier: 'v' });

    expect(mockExchangeAuthorizationCodeMock).not.toHaveBeenCalled();
    expect(exchangeOuraAuthorizationCodeMock).toHaveBeenCalledWith({ code: 'c', codeVerifier: 'v' });
  });
});

describe('OuraProvider#refreshAccessToken', () => {
  it('uses the mock refresh in mock mode', async () => {
    isOuraMockModeMock.mockReturnValue(true);
    mockRefreshAccessTokenMock.mockResolvedValue(OURA_TOKEN_RESPONSE);
    const provider = new OuraProvider();

    await provider.refreshAccessToken({ refreshToken: 'old' });

    expect(refreshOuraAccessTokenMock).not.toHaveBeenCalled();
    expect(mockRefreshAccessTokenMock).toHaveBeenCalled();
  });

  it('uses the real refresh when mock mode is off', async () => {
    isOuraMockModeMock.mockReturnValue(false);
    refreshOuraAccessTokenMock.mockResolvedValue(OURA_TOKEN_RESPONSE);
    const provider = new OuraProvider();

    await provider.refreshAccessToken({ refreshToken: 'old' });

    expect(refreshOuraAccessTokenMock).toHaveBeenCalledWith({ refreshToken: 'old' });
  });
});

describe('OuraProvider#revokeTokens', () => {
  it('calls the mock revoke in mock mode', async () => {
    isOuraMockModeMock.mockReturnValue(true);
    const provider = new OuraProvider();

    await provider.revokeTokens({ accessToken: 'at' });

    expect(mockRevokeTokensMock).toHaveBeenCalled();
    expect(revokeOuraTokensMock).not.toHaveBeenCalled();
  });

  it('calls the real revoke when mock mode is off', async () => {
    isOuraMockModeMock.mockReturnValue(false);
    const provider = new OuraProvider();

    await provider.revokeTokens({ accessToken: 'at' });

    expect(revokeOuraTokensMock).toHaveBeenCalledWith({ accessToken: 'at' });
  });
});

describe('getOuraProvider', () => {
  it('returns the same instance on every call (singleton)', () => {
    const a = getOuraProvider();
    const b = getOuraProvider();
    expect(a).toBe(b);
  });

  it('registers itself into the provider registry on first call', () => {
    expect(getProvider('OURA')).toBeUndefined();

    const provider = getOuraProvider();

    expect(getProvider('OURA')).toBe(provider);
  });
});

const FROM = new Date('2026-01-01T00:00:00Z');
const TO = new Date('2026-01-02T00:00:00Z');

describe('OuraProvider#fetchRawData', () => {
  it('delegates to mockFetchRawData in mock mode, without calling any real endpoint', async () => {
    isOuraMockModeMock.mockReturnValue(true);
    mockFetchRawDataMock.mockReturnValue({ records: [{ dataType: 'DAILY_SLEEP' }], failures: [] });
    const provider = new OuraProvider();

    const result = await provider.fetchRawData({ accessToken: 'at', from: FROM, to: TO });

    expect(result).toEqual({ records: [{ dataType: 'DAILY_SLEEP' }], failures: [] });
    expect(mockFetchRawDataMock).toHaveBeenCalledWith(FROM, TO);
    expect(fetchOuraDailySleepMock).not.toHaveBeenCalled();
  });

  it('in real mode, calls all six endpoints and combines their records', async () => {
    isOuraMockModeMock.mockReturnValue(false);
    fetchOuraDailySleepMock.mockResolvedValue([{ id: 'sleep-1', day: '2026-01-01' }]);
    fetchOuraDailyReadinessMock.mockResolvedValue([{ id: 'ready-1', day: '2026-01-01' }]);
    fetchOuraDailyActivityMock.mockResolvedValue([{ id: 'act-1', day: '2026-01-01' }]);
    fetchOuraHeartRateMock.mockResolvedValue([{ timestamp: '2026-01-01T00:05:00Z' }]);
    fetchOuraWorkoutsMock.mockResolvedValue([{ id: 'w-1', start_datetime: '2026-01-01T17:00:00Z' }]);
    fetchOuraDailySpo2Mock.mockResolvedValue([{ id: 'spo2-1', day: '2026-01-01' }]);
    const provider = new OuraProvider();

    const result = await provider.fetchRawData({ accessToken: 'at', from: FROM, to: TO });

    expect(result.failures).toEqual([]);
    expect(result.records).toHaveLength(6);
    const dataTypes = result.records.map((r) => r.dataType).sort();
    expect(dataTypes).toEqual(
      ['DAILY_ACTIVITY', 'DAILY_READINESS', 'DAILY_SLEEP', 'HEART_RATE', 'SPO2', 'WORKOUT'].sort(),
    );
    expect(fetchOuraDailySleepMock).toHaveBeenCalledWith('at', FROM, TO);
  });

  it('in real mode, one endpoint failing does not discard the records the other five returned', async () => {
    isOuraMockModeMock.mockReturnValue(false);
    fetchOuraDailySleepMock.mockResolvedValue([{ id: 'sleep-1', day: '2026-01-01' }]);
    fetchOuraDailyReadinessMock.mockResolvedValue([]);
    fetchOuraDailyActivityMock.mockResolvedValue([]);
    fetchOuraHeartRateMock.mockResolvedValue([]);
    fetchOuraWorkoutsMock.mockRejectedValue(new Error('Oura workout request failed with status 503'));
    fetchOuraDailySpo2Mock.mockResolvedValue([]);
    const provider = new OuraProvider();

    const result = await provider.fetchRawData({ accessToken: 'at', from: FROM, to: TO });

    expect(result.records).toEqual([
      { dataType: 'DAILY_SLEEP', externalId: 'sleep-1', dataDate: new Date('2026-01-01'), payload: { id: 'sleep-1', day: '2026-01-01' } },
    ]);
    expect(result.failures).toEqual([
      { dataType: 'WORKOUT', message: 'Oura workout request failed with status 503' },
    ]);
  });
});

describe('OuraProvider#mapToNormalizedFields', () => {
  it('delegates to mapOuraRecordToDailyMetric', () => {
    const record = { dataType: 'DAILY_SLEEP' as const, externalId: 's1', dataDate: FROM, payload: {} };
    mapOuraRecordToDailyMetricMock.mockReturnValue({ date: FROM, fields: { sleepScore: 80 } });
    const provider = new OuraProvider();

    const result = provider.mapToNormalizedFields(record);

    expect(mapOuraRecordToDailyMetricMock).toHaveBeenCalledWith(record);
    expect(result).toEqual({ date: FROM, fields: { sleepScore: 80 } });
  });
});

describe('OuraProvider#mapToWorkout', () => {
  it('delegates to mapOuraRecordToWorkout', () => {
    const record = { dataType: 'WORKOUT' as const, externalId: 'w1', dataDate: FROM, payload: {} };
    mapOuraRecordToWorkoutMock.mockReturnValue({
      externalId: 'w1',
      activityType: 'running',
      startedAt: FROM,
      endedAt: FROM,
      durationMin: 30,
    });
    const provider = new OuraProvider();

    const result = provider.mapToWorkout(record);

    expect(mapOuraRecordToWorkoutMock).toHaveBeenCalledWith(record);
    expect(result).toEqual({
      externalId: 'w1',
      activityType: 'running',
      startedAt: FROM,
      endedAt: FROM,
      durationMin: 30,
    });
  });
});
