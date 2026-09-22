import type { WearableConnectionStatus, WearableDataType, WearableProvider } from '@prisma/client';

/**
 * Pure types and the provider adapter CONTRACT — zero I/O, zero framework
 * imports (see ARCHITECTURE.md §2's layout rules). Nothing in this file may
 * import from modules/wearable/providers/oura/* — the whole point of this
 * layer is that it does NOT know Oura (or Garmin, or Whoop) exists.
 *
 * `WearableProviderAdapter` is the seam Phase 4 (OAuth) and Phase 5
 * (ingestion) implement against. Defining it now — before any concrete
 * adapter exists — is what lets the OAuth Route Handlers in Phase 4 be
 * written against an interface instead of an Oura-specific client, and is
 * what `no-restricted-imports` in .eslintrc.json enforces: only
 * modules/wearable/providers/oura/* may ever import Oura's own types.
 */

// Re-exported under a module-local name so call sites read
// `WearableProviderId` (a domain concept) rather than reaching into
// `@prisma/client` directly for something that isn't persistence-specific.
export type WearableProviderId = WearableProvider;

/**
 * Only Oura has a real adapter today. The Prisma enum also defines GARMIN,
 * WHOOP, FITBIT, APPLE_HEALTH and SAMSUNG_HEALTH (ARCHITECTURE.md §3) so the
 * schema doesn't need a migration when a second provider is added later —
 * but nothing register()s an adapter for them yet, so they must never appear
 * in a connection list or a "connect" UI until they do.
 */
export const SUPPORTED_WEARABLE_PROVIDERS: readonly WearableProviderId[] = [
  'OURA',
] as const;

export function isSupportedWearableProvider(
  provider: string,
): provider is WearableProviderId {
  return (SUPPORTED_WEARABLE_PROVIDERS as readonly string[]).includes(provider);
}

/** Result of a successful OAuth token exchange or refresh — plaintext, in memory only. */
export interface OAuthTokenSet {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  grantedScopes: string[];
}

/**
 * What the connect route hands back to the browser. Assembled by the ROUTE
 * (`api/integrations/oura/connect`), not by the adapter: `state` and
 * `codeVerifier` are generic OAuth/PKCE concerns (lib/auth/pkce.ts,
 * modules/wearable/services/oauth-state.service.ts) that apply identically
 * to every provider, so the adapter only ever contributes the
 * provider-specific `authorizationUrl` — see `buildAuthorizationUrl` below.
 */
export interface AuthorizationRequest {
  authorizationUrl: string;
  state: string;
  expiresAt: Date;
}

/**
 * The provider-agnostic contract every wearable integration must implement.
 * No method here may leak a provider-specific shape — callers (Route
 * Handlers, jobs, the MCP gateway) only ever see these types, never Oura's
 * own JSON. Phase 4 shipped the OAuth methods; Phase 5 adds the ingestion
 * methods below (`fetchRawData`/`mapToNormalizedFields`/`mapToWorkout`).
 *
 * Revised in Phase 4 from its original Phase 3 shape: `buildAuthorizationUrl`
 * used to be `buildAuthorizationRequest(userId, redirectUri)` and returned
 * the full `AuthorizationRequest` (including `state`), which wrongly made
 * the adapter responsible for generating and persisting OAuth state — a
 * generic concern, not a provider-specific one. Nothing implemented the old
 * shape yet (Phase 3 shipped the interface with zero implementations), so
 * this is a design refinement, not a breaking change to running code.
 * `redirectUri` was dropped from `buildAuthorizationUrl`/
 * `exchangeAuthorizationCode`'s params for the same reason: the redirect URI
 * is registered with the provider's own dashboard and is therefore
 * provider-specific config the adapter already owns (`getRedirectUri()`),
 * not something the generic connect/callback routes should independently
 * know or reconstruct.
 */
export interface WearableProviderAdapter {
  readonly id: WearableProviderId;

  /** The redirect URI this adapter is configured with — the connect route records it on the OAuthState row for audit purposes. */
  getRedirectUri(): string;

  /** Builds the provider's own authorize-URL query string from an already-generated state/PKCE challenge. Pure/synchronous — no I/O beyond reading its own env-based client config. */
  buildAuthorizationUrl(params: { state: string; codeChallenge: string }): string;

  exchangeAuthorizationCode(params: {
    code: string;
    codeVerifier: string;
  }): Promise<OAuthTokenSet>;

  refreshAccessToken(params: { refreshToken: string }): Promise<OAuthTokenSet>;

  revokeTokens(params: { accessToken: string }): Promise<void>;

  /**
   * Phase 5: fetch every supported data type for [from, to] (inclusive) and
   * return it as opaque, provider-tagged raw records — never a mapped/
   * normalized shape. Each of the provider's own data-type endpoints fails
   * independently (`failures`) rather than the whole call rejecting, so one
   * bad endpoint (e.g. Oura's workout endpoint erroring) never discards data
   * that other endpoints successfully returned — the caller decides whether
   * that adds up to a SUCCESS, PARTIAL or FAILED sync.
   */
  fetchRawData(params: {
    accessToken: string;
    from: Date;
    to: Date;
  }): Promise<FetchRawDataResult>;

  /**
   * Maps ONE raw record into the fields it contributes to that day's
   * DailyHealthMetric row, or null if this record's dataType doesn't map to
   * any daily-metric field (e.g. Oura's intraday HEART_RATE samples are
   * stored raw for future use but don't normalize into anything yet — this
   * app's DailyHealthMetric has no finer-grained heart-rate field than
   * restingHeartRate, which the sleep record already supplies). Only the
   * adapter itself may ever read `payload`'s shape — see
   * modules/wearable/providers/oura/oura-mappers.ts.
   */
  mapToNormalizedFields(record: ProviderRawRecord): NormalizedDailyMetric | null;

  /** Maps ONE raw record into a Workout row, or null if this record's dataType isn't a workout. */
  mapToWorkout(record: ProviderRawRecord): NormalizedWorkout | null;
}

/**
 * An opaque, provider-tagged raw record — the shape WearableRawRecord
 * persists verbatim. `payload` is deliberately `unknown`: nothing outside
 * modules/wearable/providers/<provider>/* may assume anything about its
 * structure, mirroring the same isolation `OAuthTokenSet` gives the OAuth
 * side (ARCHITECTURE.md §2).
 */
export interface ProviderRawRecord {
  dataType: WearableDataType;
  /** The provider's own stable id for this record — the idempotency key alongside (connectionId, dataType). */
  externalId: string;
  /** The calendar day this record belongs to (UTC midnight) — WearableRawRecord.dataDate is a `@db.Date` column. */
  dataDate: Date;
  payload: unknown;
}

export interface FetchRawDataResult {
  records: ProviderRawRecord[];
  failures: Array<{ dataType: WearableDataType; message: string }>;
}

/** The subset of DailyHealthMetric's own (non-relational) fields one raw record can contribute — always a partial, since e.g. a sleep record never sets `steps`. */
export interface NormalizedDailyMetricFields {
  sleepScore?: number;
  readinessScore?: number;
  activityScore?: number;
  totalSleepMinutes?: number;
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  lightSleepMinutes?: number;
  awakeMinutes?: number;
  sleepEfficiencyPct?: number;
  sleepLatencyMinutes?: number;
  bedtimeStart?: Date;
  bedtimeEnd?: Date;
  restingHeartRate?: number;
  averageHrv?: number;
  temperatureDeviationC?: number;
  steps?: number;
  activeCalories?: number;
  totalCalories?: number;
  walkingEquivalentMin?: number;
  sedentaryMinutes?: number;
  spo2Average?: number;
}

export interface NormalizedDailyMetric {
  /** Calendar day (UTC midnight) — the merge/upsert key into DailyHealthMetric alongside userId. */
  date: Date;
  fields: NormalizedDailyMetricFields;
}

export interface NormalizedWorkout {
  externalId: string;
  activityType: string;
  startedAt: Date;
  endedAt: Date;
  durationMin: number;
  calories?: number;
  distanceM?: number;
  intensity?: string;
}

/**
 * Safe-to-return-to-the-client summary of a connection — never includes
 * anything from EncryptedCredential. `id` is null when no WearableConnection
 * row exists yet (the user has never started connecting this provider), so
 * the UI/API always has one entry per supported provider instead of having
 * to special-case "never connected".
 */
export interface ConnectionSummary {
  id: string | null;
  provider: WearableProviderId;
  status: WearableConnectionStatus;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  grantedScopes: string[];
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
}
