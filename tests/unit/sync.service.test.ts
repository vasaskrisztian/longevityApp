import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WearableProviderAdapter } from '@/modules/wearable/domain/wearable-provider.types';

const ensureFreshAccessTokenMock = vi.fn();
vi.mock('@/modules/wearable/services/refresh-credential.service', () => ({
  ensureFreshAccessToken: ensureFreshAccessTokenMock,
}));

const storeRawRecordsMock = vi.fn();
vi.mock('@/modules/wearable/services/raw-record.service', () => ({
  storeRawRecords: storeRawRecordsMock,
}));

const normalizeAndUpsertDailyMetricsMock = vi.fn();
const normalizeAndUpsertWorkoutsMock = vi.fn();
vi.mock('@/modules/wearable/services/normalization.service', () => ({
  normalizeAndUpsertDailyMetrics: normalizeAndUpsertDailyMetricsMock,
  normalizeAndUpsertWorkouts: normalizeAndUpsertWorkoutsMock,
}));

const recordSyncOutcomeMock = vi.fn();
vi.mock('@/modules/wearable/services/wearable.service', () => ({
  recordSyncOutcome: recordSyncOutcomeMock,
}));

const { runSyncForConnection } = await import('@/modules/wearable/services/sync.service');

const FROM = new Date('2026-01-01T00:00:00Z');
const TO = new Date('2026-01-30T00:00:00Z');

function fakeAdapter(overrides: Partial<WearableProviderAdapter> = {}): WearableProviderAdapter {
  return {
    id: 'OURA',
    getRedirectUri: () => '',
    buildAuthorizationUrl: () => '',
    exchangeAuthorizationCode: vi.fn(),
    refreshAccessToken: vi.fn(),
    revokeTokens: vi.fn(),
    fetchRawData: vi.fn(),
    mapToNormalizedFields: () => null,
    mapToWorkout: () => null,
    ...overrides,
  };
}

const RECORD = { dataType: 'DAILY_SLEEP' as const, externalId: 's1', dataDate: FROM, payload: {} };

beforeEach(() => {
  vi.clearAllMocks();
  normalizeAndUpsertDailyMetricsMock.mockResolvedValue({ datesUpserted: 0 });
  normalizeAndUpsertWorkoutsMock.mockResolvedValue({ workoutsUpserted: 0 });
  storeRawRecordsMock.mockResolvedValue({ created: 0, updated: 0 });
  recordSyncOutcomeMock.mockResolvedValue(undefined);
});

describe('runSyncForConnection — token refresh fails', () => {
  it('returns a FAILED result with errorCode AUTH_REQUIRED, records the outcome, and never fetches', async () => {
    const authError = new Error('refresh rejected');
    ensureFreshAccessTokenMock.mockRejectedValue(authError);
    const adapter = fakeAdapter();

    const result = await runSyncForConnection({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      adapter,
      from: FROM,
      to: TO,
    });

    expect(result).toEqual({
      status: 'FAILED',
      recordsFetched: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      datesUpserted: 0,
      workoutsUpserted: 0,
      errorCode: 'AUTH_REQUIRED',
      errorMessage: 'refresh rejected',
    });
    expect(adapter.fetchRawData).not.toHaveBeenCalled();
    expect(recordSyncOutcomeMock).toHaveBeenCalledWith('conn-1', 'FAILED');
  });
});

describe('runSyncForConnection — every endpoint fails', () => {
  it('returns FAILED with errorCode FETCH_FAILED when nothing was fetched and there were failures', async () => {
    ensureFreshAccessTokenMock.mockResolvedValue({ accessToken: 'at', accessTokenExpiresAt: new Date() });
    const adapter = fakeAdapter({
      fetchRawData: vi.fn().mockResolvedValue({
        records: [],
        failures: [{ dataType: 'DAILY_SLEEP', message: 'timeout' }],
      }),
    });

    const result = await runSyncForConnection({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      adapter,
      from: FROM,
      to: TO,
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('FETCH_FAILED');
    expect(result.errorMessage).toContain('DAILY_SLEEP: timeout');
    expect(storeRawRecordsMock).not.toHaveBeenCalled();
    expect(recordSyncOutcomeMock).toHaveBeenCalledWith('conn-1', 'FAILED');
  });
});

describe('runSyncForConnection — full success', () => {
  it('stores raw records, normalizes daily metrics and workouts, and records a SUCCESS outcome', async () => {
    ensureFreshAccessTokenMock.mockResolvedValue({ accessToken: 'at', accessTokenExpiresAt: new Date() });
    const adapter = fakeAdapter({
      fetchRawData: vi.fn().mockResolvedValue({ records: [RECORD], failures: [] }),
    });
    storeRawRecordsMock.mockResolvedValue({ created: 1, updated: 0 });
    normalizeAndUpsertDailyMetricsMock.mockResolvedValue({ datesUpserted: 1 });
    normalizeAndUpsertWorkoutsMock.mockResolvedValue({ workoutsUpserted: 0 });

    const result = await runSyncForConnection({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      adapter,
      from: FROM,
      to: TO,
    });

    expect(storeRawRecordsMock).toHaveBeenCalledWith({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      records: [RECORD],
    });
    expect(normalizeAndUpsertDailyMetricsMock).toHaveBeenCalledWith({
      userId: 'u1',
      provider: 'OURA',
      records: [RECORD],
      adapter,
    });
    expect(normalizeAndUpsertWorkoutsMock).toHaveBeenCalledWith({
      userId: 'u1',
      provider: 'OURA',
      records: [RECORD],
      adapter,
    });
    expect(result).toEqual({
      status: 'SUCCESS',
      recordsFetched: 1,
      recordsCreated: 1,
      recordsUpdated: 0,
      datesUpserted: 1,
      workoutsUpserted: 0,
      errorCode: undefined,
      errorMessage: undefined,
    });
    expect(recordSyncOutcomeMock).toHaveBeenCalledWith('conn-1', 'SUCCESS');
  });
});

describe('runSyncForConnection — partial success', () => {
  it('returns PARTIAL and still stores/normalizes the records that did come back', async () => {
    ensureFreshAccessTokenMock.mockResolvedValue({ accessToken: 'at', accessTokenExpiresAt: new Date() });
    const adapter = fakeAdapter({
      fetchRawData: vi.fn().mockResolvedValue({
        records: [RECORD],
        failures: [{ dataType: 'WORKOUT', message: '503' }],
      }),
    });
    storeRawRecordsMock.mockResolvedValue({ created: 1, updated: 0 });

    const result = await runSyncForConnection({
      userId: 'u1',
      connectionId: 'conn-1',
      provider: 'OURA',
      adapter,
      from: FROM,
      to: TO,
    });

    expect(result.status).toBe('PARTIAL');
    expect(result.errorCode).toBe('PARTIAL_FETCH_FAILURE');
    expect(result.errorMessage).toContain('WORKOUT: 503');
    expect(storeRawRecordsMock).toHaveBeenCalled();
    expect(recordSyncOutcomeMock).toHaveBeenCalledWith('conn-1', 'PARTIAL');
  });
});
