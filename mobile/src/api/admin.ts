import { apiFetch, apiFetchJson } from '@/src/api/client';
import type { DashboardSnapshot } from '@/src/api/dashboard';

/**
 * Phase 22 (mobile admin). Every type/function here mirrors a web admin
 * route 1:1 — see claude/phase-15-mobile-migration-plan.md's Phase 22
 * section for the full mapping. All 5 routes are already gated by the
 * server's requireAdmin() (Bearer-compatible since phase 16), so nothing
 * here does its own role check — a non-admin simply gets a 403 from the
 * server, same as web.
 */

export interface AdminStats {
  totalUsers: number;
  ouraConnected: number;
  authRequired: number;
  failedSyncsToday: number;
}

/** GET /api/admin/stats — new in phase 22; see admin.service.ts's getAdminStats
 * doc comment for why this route didn't already exist (the web dashboard
 * computed these 4 counts inline in a server component). */
export function getAdminStats(): Promise<AdminStats> {
  return apiFetchJson<AdminStats>('/api/admin/stats');
}

export type AdminOuraStatusFilter = 'ALL' | 'CONNECTED' | 'AUTH_REQUIRED' | 'ERROR' | 'DISCONNECTED';

export interface AdminUserListItem {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  ouraStatus: string;
  /** ISO datetime string, or null if this user has never synced. */
  lastSyncAt: string | null;
  /** ISO datetime string. */
  createdAt: string;
}

export interface AdminUserListResult {
  users: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserListQuery {
  q?: string;
  ouraStatus?: AdminOuraStatusFilter;
  page?: number;
  pageSize?: number;
}

/** GET /api/admin/users?q=&ouraStatus=&page=&pageSize= — mirrors
 * admin-users-table.tsx's query building exactly (same defaults: ouraStatus
 * 'ALL', page 1, pageSize 20, empty q omitted). */
export function getAdminUsers(query: AdminUserListQuery = {}): Promise<AdminUserListResult> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  params.set('ouraStatus', query.ouraStatus ?? 'ALL');
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 20));
  return apiFetchJson<AdminUserListResult>(`/api/admin/users?${params.toString()}`);
}

/**
 * Mirrors wearable-provider.types.ts's ConnectionSummary, with its two Date
 * fields as ISO strings (Response.json's serialization) instead of Date.
 */
export interface AdminConnectionSummary {
  id: string | null;
  provider: string;
  status: string;
  /** ISO datetime string, or null if never connected. */
  connectedAt: string | null;
  /** ISO datetime string, or null. */
  disconnectedAt: string | null;
  grantedScopes: string[];
  /** ISO datetime string, or null. */
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

export interface AdminSyncJob {
  id: string;
  type: string;
  status: string;
  /** ISO datetime string, or null. */
  startedAt: string | null;
  /** ISO datetime string, or null. */
  finishedAt: string | null;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  errorCode: string | null;
  errorMessage: string | null;
  /** ISO datetime string. */
  createdAt: string;
}

export interface AdminUserDetail {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
    status: string;
    accountType: string;
    /** ISO datetime string, or null — set only while the user has active creator consent. */
    publicProfileConsentAt: string | null;
    /** ISO datetime string, or null. */
    emailVerifiedAt: string | null;
    /** ISO datetime string, or null. */
    lastLoginAt: string | null;
    /** ISO datetime string. */
    createdAt: string;
  };
  connection: AdminConnectionSummary;
  /** Same shape dashboard.ts's DashboardSnapshot uses — reused here instead
   * of redefining it, since the server's getTodaySnapshot backs both. */
  todaySnapshot: DashboardSnapshot | null;
  recentSyncJobs: AdminSyncJob[];
}

/** GET /api/admin/users/:id/dashboard — a 404 here means the target user id
 * doesn't exist (not an authorization failure, which the server returns as
 * a 403 before this route is ever reached), so it's surfaced as `null`
 * rather than thrown, same precedent as getCreatorProfile in creators.ts.
 * Note: unlike that public route, this one IS audited server-side on every
 * successful call (ADMIN_VIEW_USER) — don't call it speculatively. */
export async function getAdminUserDetail(id: string): Promise<AdminUserDetail | null> {
  const response = await apiFetch(`/api/admin/users/${id}/dashboard`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load user detail (${response.status}).`);
  return response.json();
}

export type AdminAccountType = 'MEMBER' | 'CREATOR';

/** PATCH /api/admin/users/:id/account-type — the only way an account
 * becomes/stops being a CREATOR (see admin.service.ts's setUserAccountType
 * doc comment: demoting cascades server-side to PRIVATE visibility on all
 * of that user's protocols/challenges). Mirrors set-account-type-button.tsx:
 * callers should show its demotion warning copy themselves before calling
 * this with 'MEMBER'. */
export async function setAccountType(id: string, accountType: AdminAccountType): Promise<AdminAccountType> {
  const { accountType: updated } = await apiFetchJson<{ accountType: AdminAccountType }>(
    `/api/admin/users/${id}/account-type`,
    { method: 'PATCH', body: JSON.stringify({ accountType }) },
  );
  return updated;
}

export type TriggerSyncResult =
  | { status: 'success'; jobId: string }
  | { status: 'rate_limited' }
  | { status: 'not_connected' }
  | { status: 'error' };

/** POST /api/admin/users/:id/sync — mirrors trigger-sync-button.tsx's exact
 * status-code dispatch (202/429/409/else) rather than throwing on the
 * expected non-200 outcomes, since the web button treats all four as normal
 * UI states with their own copy, not error conditions. */
export async function triggerSync(id: string): Promise<TriggerSyncResult> {
  const response = await apiFetch(`/api/admin/users/${id}/sync`, { method: 'POST' });
  if (response.status === 202) {
    const { jobId } = await response.json();
    return { status: 'success', jobId };
  }
  if (response.status === 429) return { status: 'rate_limited' };
  if (response.status === 409) return { status: 'not_connected' };
  return { status: 'error' };
}
