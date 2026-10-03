import { apiFetchJson } from '@/src/api/client';

/** Mirrors modules/wearable/domain/wearable-provider.types.ts's ConnectionSummary. */
export interface ConnectionSummary {
  id: string | null;
  provider: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | string;
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
