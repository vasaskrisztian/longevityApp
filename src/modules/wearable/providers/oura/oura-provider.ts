import { registerProvider } from '../../domain/provider-registry';
import type {
  WearableProviderAdapter,
  OAuthTokenSet,
  FetchRawDataResult,
  ProviderRawRecord,
  NormalizedDailyMetric,
  NormalizedWorkout,
} from '../../domain/wearable-provider.types';
import { isOuraMockMode, loadOuraCredentials } from './oura-config';
import {
  buildOuraAuthorizeUrl,
  exchangeOuraAuthorizationCode,
  refreshOuraAccessToken,
  revokeOuraTokens,
} from './oura-auth';
import {
  mockExchangeAuthorizationCode,
  mockRefreshAccessToken,
  mockRevokeTokens,
} from './oura-mock';
import type { OuraTokenResponse } from './oura-types';
import {
  fetchOuraDailyActivity,
  fetchOuraDailyReadiness,
  fetchOuraDailySleep,
  fetchOuraDailySpo2,
  fetchOuraHeartRate,
  fetchOuraWorkouts,
} from './oura-api-client';
import { mockFetchRawData } from './oura-ingestion-mock';
import { mapOuraRecordToDailyMetric, mapOuraRecordToWorkout } from './oura-mappers';
import type {
  OuraDailyActivityRecord,
  OuraDailyReadinessRecord,
  OuraDailySleepRecord,
  OuraDailySpo2Record,
  OuraHeartRateRecord,
  OuraWorkoutRecord,
} from './oura-data-types';

type FetchRawDataTask = { dataType: ProviderRawRecord['dataType']; run: () => Promise<ProviderRawRecord[]> };

function buildFetchTasks(accessToken: string, from: Date, to: Date): FetchRawDataTask[] {
  return [
    {
      dataType: 'DAILY_SLEEP',
      run: async () =>
        (await fetchOuraDailySleep(accessToken, from, to)).map(
          (r: OuraDailySleepRecord): ProviderRawRecord => ({
            dataType: 'DAILY_SLEEP',
            externalId: r.id,
            dataDate: new Date(r.day),
            payload: r,
          }),
        ),
    },
    {
      dataType: 'DAILY_READINESS',
      run: async () =>
        (await fetchOuraDailyReadiness(accessToken, from, to)).map(
          (r: OuraDailyReadinessRecord): ProviderRawRecord => ({
            dataType: 'DAILY_READINESS',
            externalId: r.id,
            dataDate: new Date(r.day),
            payload: r,
          }),
        ),
    },
    {
      dataType: 'DAILY_ACTIVITY',
      run: async () =>
        (await fetchOuraDailyActivity(accessToken, from, to)).map(
          (r: OuraDailyActivityRecord): ProviderRawRecord => ({
            dataType: 'DAILY_ACTIVITY',
            externalId: r.id,
            dataDate: new Date(r.day),
            payload: r,
          }),
        ),
    },
    {
      dataType: 'HEART_RATE',
      run: async () =>
        (await fetchOuraHeartRate(accessToken, from, to)).map(
          (r: OuraHeartRateRecord): ProviderRawRecord => ({
            dataType: 'HEART_RATE',
            externalId: r.timestamp,
            dataDate: new Date(r.timestamp.slice(0, 10)),
            payload: r,
          }),
        ),
    },
    {
      dataType: 'WORKOUT',
      run: async () =>
        (await fetchOuraWorkouts(accessToken, from, to)).map(
          (r: OuraWorkoutRecord): ProviderRawRecord => ({
            dataType: 'WORKOUT',
            externalId: r.id,
            dataDate: new Date(r.start_datetime.slice(0, 10)),
            payload: r,
          }),
        ),
    },
    {
      dataType: 'SPO2',
      run: async () =>
        (await fetchOuraDailySpo2(accessToken, from, to)).map(
          (r: OuraDailySpo2Record): ProviderRawRecord => ({
            dataType: 'SPO2',
            externalId: r.id,
            dataDate: new Date(r.day),
            payload: r,
          }),
        ),
    },
  ];
}

/** The only place an Oura wire response is mapped to the provider-agnostic OAuthTokenSet. */
function toTokenSet(response: OuraTokenResponse): OAuthTokenSet {
  return {
    accessToken: response.access_token,
    accessTokenExpiresAt: new Date(Date.now() + response.expires_in * 1000),
    refreshToken: response.refresh_token,
    grantedScopes: response.scope.split(' ').filter(Boolean),
  };
}

/**
 * The first real WearableProviderAdapter implementation. `isOuraMockMode()`
 * is checked per-call (not baked in at construction) so a test/dev server
 * can flip OURA_MOCK_MODE without restarting anything, and so unit tests can
 * exercise both branches against the same instance.
 */
export class OuraProvider implements WearableProviderAdapter {
  readonly id = 'OURA' as const;

  getRedirectUri(): string {
    return loadOuraCredentials().redirectUri;
  }

  buildAuthorizationUrl(params: { state: string; codeChallenge: string }): string {
    if (isOuraMockMode()) {
      // Still a real, well-formed URL (so a UI test can navigate it), just
      // pointed at our own callback with a marker Oura would never send —
      // nothing actually serves this route; mock mode is meant to be
      // exercised by driving the callback directly with a fabricated code.
      const url = new URL(this.getRedirectUri());
      url.searchParams.set('mock', '1');
      url.searchParams.set('state', params.state);
      return url.toString();
    }
    return buildOuraAuthorizeUrl({ state: params.state, codeChallenge: params.codeChallenge });
  }

  async exchangeAuthorizationCode(params: {
    code: string;
    codeVerifier: string;
  }): Promise<OAuthTokenSet> {
    const response = isOuraMockMode()
      ? await mockExchangeAuthorizationCode()
      : await exchangeOuraAuthorizationCode({ code: params.code, codeVerifier: params.codeVerifier });
    return toTokenSet(response);
  }

  async refreshAccessToken(params: { refreshToken: string }): Promise<OAuthTokenSet> {
    const response = isOuraMockMode()
      ? await mockRefreshAccessToken()
      : await refreshOuraAccessToken({ refreshToken: params.refreshToken });
    return toTokenSet(response);
  }

  async revokeTokens(params: { accessToken: string }): Promise<void> {
    if (isOuraMockMode()) {
      await mockRevokeTokens();
      return;
    }
    await revokeOuraTokens({ accessToken: params.accessToken });
  }

  /**
   * Runs all six of Oura's data-type endpoints independently
   * (`Promise.allSettled`) so one endpoint's failure (e.g. a transient 500 on
   * /workout) never discards data the other five successfully returned —
   * `failures` carries the per-endpoint errors for the caller
   * (modules/wearable/services/sync.service.ts) to decide whether the
   * overall sync is SUCCESS, PARTIAL or FAILED.
   */
  async fetchRawData(params: {
    accessToken: string;
    from: Date;
    to: Date;
  }): Promise<FetchRawDataResult> {
    if (isOuraMockMode()) {
      return mockFetchRawData(params.from, params.to);
    }

    const tasks = buildFetchTasks(params.accessToken, params.from, params.to);
    const settled = await Promise.allSettled(tasks.map((task) => task.run()));

    const records: ProviderRawRecord[] = [];
    const failures: FetchRawDataResult['failures'] = [];
    settled.forEach((result, index) => {
      const { dataType } = tasks[index]!;
      if (result.status === 'fulfilled') {
        records.push(...result.value);
      } else {
        failures.push({ dataType, message: (result.reason as Error).message });
      }
    });

    return { records, failures };
  }

  mapToNormalizedFields(record: ProviderRawRecord): NormalizedDailyMetric | null {
    return mapOuraRecordToDailyMetric(record);
  }

  mapToWorkout(record: ProviderRawRecord): NormalizedWorkout | null {
    return mapOuraRecordToWorkout(record);
  }
}

let instance: OuraProvider | undefined;

/**
 * Lazy singleton + composition root in one: the first call both creates the
 * adapter and registers it into the provider-registry, so generic code that
 * looks providers up by id (getProvider('OURA')) sees it too, without a
 * separate app-startup bootstrap module. Idempotent — registerProvider()
 * simply overwrites with the same instance on subsequent calls.
 */
export function getOuraProvider(): OuraProvider {
  if (!instance) {
    instance = new OuraProvider();
    registerProvider(instance);
  }
  return instance;
}

/** Test-only escape hatch — production code never needs to forget the singleton. */
export function _resetOuraProviderForTests(): void {
  instance = undefined;
}
