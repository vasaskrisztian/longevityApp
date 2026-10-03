import { secureStorage } from '@/src/auth/secureStorage';
import { API_BASE_URL } from '@/src/config/env';

/**
 * Plain (non-React) session store — both the API client (a bare function,
 * no hooks available) and the React `useSession` hook need to read/refresh
 * the same session, so the state lives here and `useSession` is a thin
 * subscription on top, rather than the token logic living inside a
 * context provider component.
 */

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

interface Session {
  accessToken: string;
  accessTokenExpiresAt: number; // ms epoch
  refreshToken: string;
  user: SessionUser;
}

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

const REFRESH_TOKEN_KEY = 'longevity.refreshToken';
const USER_KEY = 'longevity.user';

// Refresh a little before the access token actually expires, so a request
// in flight doesn't race the clock (the server's own TTL is 15 minutes —
// see lib/auth/mobile-jwt.ts).
const REFRESH_SKEW_MS = 30 * 1000;

let session: Session | null = null;
let status: SessionStatus = 'loading';
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStatus(): SessionStatus {
  return status;
}

export function getUser(): SessionUser | null {
  return session?.user ?? null;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SessionUser;
}

function applyLoginResponse(data: LoginResponse) {
  session = {
    accessToken: data.accessToken,
    accessTokenExpiresAt: Date.now() + data.expiresIn * 1000,
    refreshToken: data.refreshToken,
    user: data.user,
  };
  status = 'signedIn';
}

/**
 * Restores a session from the refresh token persisted on-device, if any.
 * Deliberately always goes through a refresh rather than also persisting
 * (and trusting) the last access token — one code path for "do we have a
 * usable session" instead of two, at the cost of one extra round trip on
 * cold start.
 */
export async function loadPersistedSession(): Promise<void> {
  if (loadPromise) {
    return loadPromise;
  }
  loadPromise = (async () => {
    const [refreshToken, userJson] = await Promise.all([
      secureStorage.getItem(REFRESH_TOKEN_KEY),
      secureStorage.getItem(USER_KEY),
    ]);

    if (!refreshToken || !userJson) {
      status = 'signedOut';
      notify();
      return;
    }

    const refreshed = await refreshWithToken(refreshToken);
    if (!refreshed) {
      await clearPersisted();
      status = 'signedOut';
      notify();
      return;
    }

    notify();
  })();
  return loadPromise;
}

async function persist() {
  if (!session) {
    return;
  }
  await Promise.all([
    secureStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken),
    secureStorage.setItem(USER_KEY, JSON.stringify(session.user)),
  ]);
}

async function clearPersisted() {
  await Promise.all([secureStorage.deleteItem(REFRESH_TOKEN_KEY), secureStorage.deleteItem(USER_KEY)]);
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsError';
  }
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (response.status === 401) {
    throw new InvalidCredentialsError();
  }
  if (!response.ok) {
    throw new Error(`Login failed (${response.status}).`);
  }

  const data = (await response.json()) as LoginResponse;
  applyLoginResponse(data);
  await persist();
  notify();
}

export async function logout(): Promise<void> {
  const refreshToken = session?.refreshToken;
  session = null;
  status = 'signedOut';
  await clearPersisted();
  notify();

  if (refreshToken) {
    // Best-effort — the route always responds 200 regardless, and the
    // user is already signed out locally either way.
    fetch(`${API_BASE_URL}/api/auth/mobile/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
}

async function refreshWithToken(refreshToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/mobile/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { accessToken: string; refreshToken: string; expiresIn: number };
    // The refresh endpoint doesn't echo the user back (it has no need to
    // re-verify who they are — the old session object already has it).
    const existingUser = session?.user ?? (await readPersistedUser());
    if (!existingUser) {
      return false;
    }
    session = {
      accessToken: data.accessToken,
      accessTokenExpiresAt: Date.now() + data.expiresIn * 1000,
      refreshToken: data.refreshToken,
      user: existingUser,
    };
    status = 'signedIn';
    await persist();
    return true;
  } catch {
    return false;
  }
}

async function readPersistedUser(): Promise<SessionUser | null> {
  const userJson = await secureStorage.getItem(USER_KEY);
  return userJson ? (JSON.parse(userJson) as SessionUser) : null;
}

/**
 * Returns a currently-valid access token, transparently refreshing first
 * if the cached one is expired (or about to be). Returns null when there's
 * no session to refresh, or the refresh token itself is no longer valid —
 * callers (the API client) treat that as "not signed in".
 */
export async function getValidAccessToken(): Promise<string | null> {
  if (status === 'loading') {
    await loadPersistedSession();
  }
  if (!session) {
    return null;
  }
  if (Date.now() < session.accessTokenExpiresAt - REFRESH_SKEW_MS) {
    return session.accessToken;
  }

  const refreshed = await refreshWithToken(session.refreshToken);
  if (!refreshed) {
    session = null;
    status = 'signedOut';
    await clearPersisted();
    notify();
    return null;
  }
  return session.accessToken;
}

/** Test-only escape hatch, mirroring lib/queue/connection.ts's pattern on the backend. */
export function _resetSessionStoreForTests(): void {
  session = null;
  status = 'loading';
  loadPromise = null;
  listeners.clear();
}
