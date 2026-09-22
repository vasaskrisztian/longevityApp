'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export interface AdminUserListItemDTO {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  ouraStatus: string;
  lastSyncAt: string | null; // ISO
  createdAt: string; // ISO
}

export interface AdminUserListResultDTO {
  users: AdminUserListItemDTO[];
  total: number;
  page: number;
  pageSize: number;
}

const OURA_STATUS_OPTIONS = ['ALL', 'CONNECTED', 'AUTH_REQUIRED', 'ERROR', 'DISCONNECTED'] as const;

const OURA_STATUS_LABEL: Record<string, string> = {
  ALL: 'All Oura statuses',
  CONNECTED: 'Connected',
  AUTH_REQUIRED: 'Reconnect required',
  ERROR: 'Connection error',
  DISCONNECTED: 'Not connected',
};

/**
 * Server-renders the first, unfiltered page (see admin/page.tsx) so the
 * table isn't empty on first paint; every search/filter/pagination change
 * after that client-fetches `GET /api/admin/users` — the same pattern
 * trend-charts.tsx (Phase 6) uses for its 7/30-day toggle.
 */
export function AdminUsersTable({ initial }: { initial: AdminUserListResultDTO }) {
  const [q, setQ] = useState('');
  const [ouraStatus, setOuraStatus] = useState<(typeof OURA_STATUS_OPTIONS)[number]>('ALL');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AdminUserListResultDTO>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(result.total / result.pageSize)),
    [result.total, result.pageSize],
  );

  useEffect(() => {
    // Skip the very first render — `initial` already reflects q='', ouraStatus='ALL', page=1.
    if (q === '' && ouraStatus === 'ALL' && page === 1 && result === initial) {
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(
      async () => {
        setLoading(true);
        setError(null);
        try {
          const params = new URLSearchParams({ ouraStatus, page: String(page), pageSize: '20' });
          if (q) params.set('q', q);
          const response = await fetch(`/api/admin/users?${params.toString()}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error('request_failed');
          const data: AdminUserListResultDTO = await response.json();
          setResult(data);
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            setError('Could not load users. Please try again.');
          }
        } finally {
          setLoading(false);
        }
      },
      q ? 300 : 0,
    ); // debounce free-text search only — filter/page changes fetch immediately

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, ouraStatus, page]);

  function handleFilterChange(next: Partial<{ q: string; ouraStatus: typeof ouraStatus }>) {
    if ('q' in next) setQ(next.q!);
    if ('ouraStatus' in next) setOuraStatus(next.ouraStatus!);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by name or email…"
          value={q}
          onChange={(e) => handleFilterChange({ q: e.target.value })}
          className="sm:max-w-xs"
          aria-label="Search users"
        />
        <Select
          value={ouraStatus}
          onChange={(e) => handleFilterChange({ ouraStatus: e.target.value as typeof ouraStatus })}
          className="sm:max-w-[220px]"
          aria-label="Filter by Oura status"
        >
          {OURA_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {OURA_STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className={loading ? 'opacity-60' : undefined} aria-busy={loading}>
        <div className="overflow-x-auto rounded-xl border border-card-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-card-border bg-muted text-muted-foreground">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Oura status</th>
                <th className="px-4 py-2 font-medium">Last sync</th>
              </tr>
            </thead>
            <tbody>
              {result.users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No users match these filters.
                  </td>
                </tr>
              )}
              {result.users.map((user) => (
                <tr key={user.id} className="border-b border-card-border last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <Link href={`/admin/users/${user.id}`} className="font-medium text-primary hover:underline">
                      {user.fullName ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{user.email}</td>
                  <td className="px-4 py-2">{user.role}</td>
                  <td className="px-4 py-2">{OURA_STATUS_LABEL[user.ouraStatus] ?? user.ouraStatus}</td>
                  <td className="px-4 py-2">
                    {user.lastSyncAt ? new Date(user.lastSyncAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {result.page} of {totalPages} ({result.total} users)
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
