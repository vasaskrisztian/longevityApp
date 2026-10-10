/**
 * Client half of the login-time auto sync (mirror of src/lib/wearable/session-sync-flow.ts in the
 * web app — keep the two in step): ask the server to sync what is stale, then, if a server-pulled
 * sync is in flight, poll the connections list until that provider's `lastSyncAt` moves.
 */

export interface SessionSyncEntry {
  provider: string;
  status: 'queued' | 'in_progress' | 'fresh' | 'device_push' | 'reconnect_required' | 'error' | string;
  jobId?: string;
  lastSyncAt: string | null;
}

export interface SessionSyncResponse {
  providers: SessionSyncEntry[];
  queued: boolean;
}

export interface SessionSyncFlowDeps {
  requestSessionSync(): Promise<SessionSyncResponse>;
  getConnections(): Promise<{ provider: string; lastSyncAt: string | null }[]>;
  sleep(ms: number): Promise<void>;
  /** Called once with the server's answer, before any waiting — lets the caller act on it (e.g. push Apple Health) in parallel. */
  onResponse?(response: SessionSyncResponse): void;
  /** Called once, right after the request, when a server-side sync is in flight and the flow is about to wait for it. */
  onWaiting?(response: SessionSyncResponse): void;
}

export interface SessionSyncFlowResult {
  response: SessionSyncResponse;
  /** A server-side sync was in flight, so the flow waited for it. */
  waited: boolean;
  /** A watched provider's lastSyncAt changed — fresh data is available. */
  updated: boolean;
}

export const SESSION_SYNC_POLL_INTERVAL_MS = 5000;
export const SESSION_SYNC_MAX_POLLS = 24; // ~2 minutes

export async function runSessionSyncFlow(
  deps: SessionSyncFlowDeps,
  options: { pollIntervalMs?: number; maxPolls?: number } = {},
): Promise<SessionSyncFlowResult> {
  const pollIntervalMs = options.pollIntervalMs ?? SESSION_SYNC_POLL_INTERVAL_MS;
  const maxPolls = options.maxPolls ?? SESSION_SYNC_MAX_POLLS;

  const response = await deps.requestSessionSync();
  deps.onResponse?.(response);
  const watched = response.providers.filter((p) => p.status === 'queued' || p.status === 'in_progress');
  if (watched.length === 0) return { response, waited: false, updated: false };

  deps.onWaiting?.(response);
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    await deps.sleep(pollIntervalMs);
    try {
      const connections = await deps.getConnections();
      const moved = watched.some((entry) => {
        const current = connections.find((c) => c.provider === entry.provider);
        return current !== undefined && current.lastSyncAt !== entry.lastSyncAt;
      });
      if (moved) return { response, waited: true, updated: true };
    } catch {
      // A failed poll is not a failed sync — try again on the next tick.
    }
  }
  return { response, waited: true, updated: false };
}

/** The user should be nudged to reconnect (Oura token revoked/expired). */
export function needsReconnect(response: SessionSyncResponse): string[] {
  return response.providers.filter((p) => p.status === 'reconnect_required').map((p) => p.provider);
}
