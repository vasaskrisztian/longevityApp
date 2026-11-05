import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  connectionStatusLabel,
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
import { t, useT } from '@/src/i18n';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';

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
const ouraStatusLabel = (status: string): string =>
  status === 'ALL' ? t('admin.connection.all') : connectionStatusLabel(status);
/** Built at render time so the labels follow the language. */
const filterChipOptions = (): ChipOption[] => OURA_STATUS_OPTIONS.map((v) => ({ value: v, label: ouraStatusLabel(v) }));

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <Card style={styles.kpiTile}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </Card>
  );
}

function UserRow({ user }: { user: AdminUserListItem }) {
  const { t, locale } = useT();
  return (
    <Pressable onPress={() => router.push(`/admin/users/${user.id}`)}>
      <Card style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{user.fullName ?? user.email}</Text>
          <Text style={styles.rowSubtitle}>{user.email}</Text>
          <Text style={styles.rowSubtitle}>
            {user.role} · {ouraStatusLabel(user.ouraStatus)} ·{' '}
            {user.lastSyncAt
              ? t('admin.users.lastSync', { date: new Date(user.lastSyncAt).toLocaleDateString(locale) })
              : t('admin.users.neverSynced')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted.foreground} />
      </Card>
    </Pressable>
  );
}

export default function AdminUsersScreen() {
  const { t } = useT();
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
      .catch(() => setStatsError(t('admin.users.statsLoadFailed')));
  }, [t]);

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
      .catch(() => setListError(t('admin.users.listLoadFailed')))
      .finally(() => setLoading(false));
  }, [query, ouraStatus, page, t]);

  useEffect(loadUsers, [loadUsers]);

  function handleFilterChange(value: string) {
    setOuraStatus(value as AdminOuraStatusFilter);
    setPage(1);
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {statsError ? <Alert variant="destructive">{statsError}</Alert> : null}
      {stats ? (
        <View style={styles.kpiGrid}>
          <KpiTile label={t('admin.users.kpi.total')} value={stats.totalUsers} />
          <KpiTile label={t('admin.users.kpi.ouraConnected')} value={stats.ouraConnected} />
          <KpiTile label={t('admin.connection.authRequired')} value={stats.authRequired} />
          <KpiTile label={t('admin.users.kpi.failedSyncs')} value={stats.failedSyncsToday} />
        </View>
      ) : !statsError ? (
        <View style={styles.statsLoading}>
          <ActivityIndicator color={colors.primary.default} />
        </View>
      ) : null}

      <Card style={styles.filtersCard}>
        <TextField
          label={t('common.search')}
          placeholder={t('admin.users.searchPlaceholder')}
          value={searchInput}
          onChangeText={setSearchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <ChipSingleSelect
          label={t('admin.users.ouraStatus')}
          options={filterChipOptions()}
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
        <Text style={styles.empty}>{t('admin.users.empty')}</Text>
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
            title={t('admin.users.previous')}
            size="sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            style={styles.flex1}
          />
          <Text style={styles.pageLabel}>
            {t('admin.users.page', { page, totalPages, total: result.total, count: result.total })}
          </Text>
          <Button
            title={t('common.next')}
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
    backgroundColor: screenBackground,
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
