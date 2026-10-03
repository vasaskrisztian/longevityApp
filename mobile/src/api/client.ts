import { getValidAccessToken } from '@/src/auth/sessionStore';
import { API_BASE_URL } from '@/src/config/env';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Authenticated fetch wrapper for every screen that talks to the existing
 * REST API (the same /api/** routes the web app calls — see
 * claude/phase-15-mobile-migration-plan.md: the backend wasn't rewritten,
 * only how mobile authenticates to it). Attaches the current Bearer access
 * token, refreshing it first if it's expired; a 401 that still comes back
 * after that means the session itself is no longer valid (refresh token
 * revoked/expired elsewhere), not a timing fluke, so it's surfaced as-is
 * rather than retried in a loop.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getValidAccessToken();

  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

export async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.error ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}
