import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  getAdminStats,
  getAdminUsers,
  type AdminOuraStatusFilter,
  type AdminStats,
  type AdminUserListItem,
  type AdminUserListResult,
} from '@/src/api/admin';
import { Alert } from '@/src/components/ui/Alert';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ChipSingleSelect, type ChipOption } from '@/src/components/ui/ChipSelect';
import { TextField } from '@/src/components/ui/TextField';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Phase 22 — mirrors the web admin dashboard (admin/page.tsx +
 * admin-users-table.tsx): 4 KPI tiles, then a searchable/filterable/
 * paginated user list. The KPI counts come from the new GET
 * /api/admin/stats route (see admin.service.ts's getAdminStats doc
 * comment for why that route didn't already exist); the user list reuses
 * the same GET /api/admin/users route and query params the web table
 * already calls, unchanged.
 *
 * Search is debounced the same 300ms as the web table's own
 * `useDebouncedValue`; the Oura-status filter and page changes refetch
 * immediately, same as web. There's no FlatList anywhere else in this app
 * (every other list screen — creators, challenges, protocols — is a plain
 * ScrollView + .map), so this keeps that convention rather than
 * introducing a new one for a page size capped at 20.
 */

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const OURA_STATUS_OPTIONS: AdminOuraStatusFilter[] = ['ALL', 'CONNECTED', 'AUTH_REQUIRED', 'ERROR', 'DISCONNECTED'];
const OURA_STATUS_LABEL: Record<AdminOuraStatusFilter, string> = {
  ALL: 'All Oura statuses',
  CONNECTED: 'Connected',
  AUTH_REQUIRED: 'Reconnect required',
  ERROR: 'Connection error',
  DISCONNECTED: 'Not connected',
};
const FILTER_CHIP_OPTIONS: ChipOption[] = OURA_STATUS_OPTIONS.map((v) => ({ value: v, label: OURA_STATUS_LABEL[v] }));

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <Card style={styles.kpiTile}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </Card>
  );
}

function UserRow({ user }: { user: AdminUserListItem }) {
  return (
    <Pressable onPress={() => router.push(`/admin/users/${user.id}`)}>
      <Card style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{user.fullName ?? user.email}</Text>
          <Text style={styles.rowSubtitle}>{user.email}</Text>
          <Text style={styles.rowSubtitle}>
            {user.role} · {OURA_STATUS_LABEL[user.ouraStatus as AdminOuraStatusFilter] ?? user.ouraStatus} ·{' '}
            {user.lastSyncAt ? `Last sync ${new Date(user.lastSyncAt).toLocaleDateString()}` : 'Never synced'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted.foreground} />
      </Card>
    </Pressable>
  );
}

export default function AdminDashboardScreen() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [ouraStatus, setOuraStatus] = useState<AdminOuraStatusFilter>('ALL');
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<AdminUserListResult | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(() => setStatsError('Could not load the admin stats.'));
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPage(1);
      setQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchInput]);

  const loadUsers = useCallback(() => {
    setLoading(true);
    setListError(null);
    getAdminUsers({ q: query || undefined, ouraStatus, page, pageSize: PAGE_SIZE })
      .then(setResult)
      .catch(() => setListError('Could not load the user list.'))
      .finally(() => setLoading(false));
  }, [query, ouraStatus, page]);

  useEffect(loadUsers, [loadUsers]);

  function handleFilterChange(value: string) {
    setOuraStatus(value as AdminOuraStatusFilter);
    setPage(1);
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.push('/admin/groups')} accessibilityRole="button">
        <Card style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Corporate wellbeing</Text>
            <Text style={styles.rowSubtitle}>Groups, invitations, members’ health data and group challenges</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted.foreground} />
        </Card>
      </Pressable>

      {statsError ? <Alert variant="destructive">{statsError}</Alert> : null}
      {stats ? (
        <View style={styles.kpiGrid}>
          <KpiTile label="Total users" value={stats.totalUsers} />
          <KpiTile label="Oura connected" value={stats.ouraConnected} />
          <KpiTile label="Reconnect required" value={stats.authRequired} />
          <KpiTile label="Failed syncs today" value={stats.failedSyncsToday} />
        </View>
      ) : !statsError ? (
        <View style={styles.statsLoading}>
          <ActivityIndicator color={colors.primary.default} />
        </View>
      ) : null}

      <Card style={styles.filtersCard}>
        <TextField
          label="Search"
          placeholder="Name or email"
          value={searchInput}
          onChangeText={setSearchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <ChipSingleSelect
          label="Oura status"
          options={FILTER_CHIP_OPTIONS}
          value={ouraStatus}
          onChange={handleFilterChange}
        />
      </Card>

      {listError ? <Alert variant="destructive">{listError}</Alert> : null}

      {loading && !result ? (
        <View style={styles.statsLoading}>
          <ActivityIndicator color={colors.primary.default} />
        </View>
      ) : result && result.users.length === 0 ? (
        <Text style={styles.empty}>No users match these filters.</Text>
      ) : result ? (
        <View style={styles.listStack}>
          {result.users.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </View>
      ) : null}

      {result && result.total > 0 ? (
        <View style={styles.pagination}>
          <Button
            title="Previous"
            size="sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            style={styles.flex1}
          />
          <Text style={styles.pageLabel}>
            Page {page} of {totalPages} ({result.total} users)
          </Text>
          <Button
            title="Next"
            size="sm"
            variant="outline"
            disabled={page >= totalPages || loading}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={styles.flex1}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  statsLoading: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiTile: {
    width: '47%',
    gap: 4,
  },
  kpiValue: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    color: colors.foreground,
  },
  kpiLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  filtersCard: {
    gap: 12,
  },
  listStack: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 15,
    color: colors.foreground,
  },
  rowSubtitle: {
    marginTop: 2,
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  empty: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flex1: {
    flex: 1,
  },
  pageLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
    textAlign: 'center',
  },
});
