import { apiFetch, apiFetchJson } from '@/src/api/client';

/** Mirrors modules/wearable/domain/wearable-provider.types.ts's ConnectionSummary. */
export interface ConnectionSummary {
  id: string | null;
  provider: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'AUTH_REQUIRED' | 'ERROR' | string;
  connectedAt: string | null;
  disconnectedAt: string | null;
  grantedScopes: string[];
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

/** GET /api/wearables — one entry per supported provider, connected or not. */
export function getConnections(): Promise<ConnectionSummary[]> {
  return apiFetchJson<ConnectionSummary[]>('/api/wearables');
}

/**
 * GET /api/integrations/oura/connect — phase 19: when called with the
 * mobile app's Bearer token, the route returns the authorization URL as
 * JSON instead of issuing a 302 (a browser navigation can't carry a custom
 * Authorization header, so the app has to open this URL itself — see
 * mobile/app/(tabs)/devices.tsx). Throws ApiError on a non-2xx response
 * (429 rate-limited, 503 not configured) via apiFetchJson.
 */
export function getOuraAuthorizationUrl(): Promise<{ authorizationUrl: string }> {
  return apiFetchJson<{ authorizationUrl: string }>('/api/integrations/oura/connect');
}

export type OuraSyncResult = 'queued' | 'rate_limited' | 'not_connected' | 'error';

/** POST /api/integrations/oura/sync — mirrors the web app's sync-now-button.tsx status mapping. */
export async function syncOura(): Promise<OuraSyncResult> {
  const response = await apiFetch('/api/integrations/oura/sync', { method: 'POST' });
  if (response.status === 202) return 'queued';
  if (response.status === 429) return 'rate_limited';
  if (response.status === 409) return 'not_connected';
  return response.ok ? 'queued' : 'error';
}

/** POST /api/integrations/oura/disconnect — phase 19's Bearer branch returns plain JSON. */
export async function disconnectOura(): Promise<void> {
  const response = await apiFetch('/api/integrations/oura/disconnect', { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Failed to disconnect Oura (${response.status}).`);
  }
}
