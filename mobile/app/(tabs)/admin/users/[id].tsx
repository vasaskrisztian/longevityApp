import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import {
  getAdminUserDetail,
  setAccountType,
  triggerSync,
  type AdminAccountType,
  type AdminUserDetail,
} from '@/src/api/admin';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Phase 22 — mirrors the web app's admin/users/[id]/page.tsx (plus its two
 * client components set-account-type-button.tsx and trigger-sync-button.tsx,
 * inlined here as local helpers since neither needs its own file on
 * mobile). Loads GET /api/admin/users/:id/dashboard, which — same as the
 * web page — writes an ADMIN_VIEW_USER audit row server-side on every
 * successful call; this screen never calls it speculatively (e.g. no
 * prefetch-on-hover, which mobile has no equivalent of anyway).
 *
 * No delete action exists in Admin and neither the web grant/revoke nor
 * sync-trigger actions have a confirmation dialog — this mirrors that
 * exactly (same precedent as every other mobile CRUD screen: no
 * window.confirm equivalent introduced for this app).
 */

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—';
}

const CONNECTION_STATUS_LABEL: Record<string, string> = {
  CONNECTED: 'Connected',
  DISCONNECTED: 'Not connected',
  AUTH_REQUIRED: 'Reconnect required',
  ERROR: 'Connection error',
};

const CONNECTION_STATUS_COLOR: Record<string, string> = {
  CONNECTED: colors.success,
  DISCONNECTED: colors.muted.foreground,
  AUTH_REQUIRED: colors.warning,
  ERROR: colors.danger,
};

const SYNC_JOB_STATUS_COLOR: Record<string, string> = {
  SUCCESS: colors.success,
  PARTIAL: colors.warning,
  FAILED: colors.danger,
  RUNNING: colors.primary.default,
  PENDING: colors.muted.foreground,
};

type TriggerSyncState = 'idle' | 'submitting' | 'success' | 'rate_limited' | 'not_connected' | 'error';

const TRIGGER_SYNC_MESSAGE: Partial<Record<TriggerSyncState, string>> = {
  success: 'Sync queued. It will run in the background shortly.',
  rate_limited: 'A sync was already triggered for this user in the last 5 minutes. Please wait before retrying.',
  not_connected: 'This user has no connected Oura account to sync.',
  error: 'Could not trigger a sync. Please try again.',
};

function MetricStat({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <View style={styles.metricStat}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value === null ? '—' : value}
        {value !== null && unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function AccountCard({ user }: { user: AdminUserDetail['user'] }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Account</Text>
      <Text style={styles.fieldRow}>Email: {user.email}</Text>
      <Text style={styles.fieldRow}>Role: {user.role}</Text>
      <Text style={styles.fieldRow}>Status: {user.status}</Text>
      <Text style={styles.fieldRow}>Email verified: {user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : 'No'}</Text>
      <Text style={styles.fieldRow}>Last login: {formatDateTime(user.lastLoginAt)}</Text>
      <Text style={styles.fieldRow}>Joined: {formatDateTime(user.createdAt)}</Text>
    </Card>
  );
}

function CreatorStatusCard({
  accountType,
  onChanged,
}: {
  accountType: string;
  onChanged: (next: AdminAccountType) => void;
}) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCreator = accountType === 'CREATOR';
  const nextType: AdminAccountType = isCreator ? 'MEMBER' : 'CREATOR';

  async function handlePress() {
    if (!id) return;
    setUpdating(true);
    setError(null);
    try {
      const updated = await setAccountType(id, nextType);
      onChanged(updated);
    } catch {
      setError('Could not update this account type. Please try again.');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Creator status</Text>
      <Text style={styles.fieldRow}>Account type: {accountType}</Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {isCreator ? (
        <Text style={styles.warningText}>
          Revoking also disables their public profile and sets all their protocols/challenges back to Private
          immediately.
        </Text>
      ) : null}
      <Button
        title={updating ? 'Updating…' : isCreator ? 'Revoke creator status' : 'Grant creator status'}
        size="sm"
        variant={isCreator ? 'destructive' : 'primary'}
        onPress={handlePress}
        loading={updating}
      />
    </Card>
  );
}

function OuraConnectionCard({ detail }: { detail: AdminUserDetail }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<TriggerSyncState>('idle');
  const { connection, todaySnapshot } = detail;

  async function handleTriggerSync() {
    if (!id) return;
    setState('submitting');
    const result = await triggerSync(id);
    setState(result.status);
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Oura connection</Text>
      <Text style={[styles.statusBadge, { color: CONNECTION_STATUS_COLOR[connection.status] ?? colors.foreground }]}>
        {CONNECTION_STATUS_LABEL[connection.status] ?? connection.status}
      </Text>
      <Text style={styles.fieldRow}>Last sync: {formatDateTime(connection.lastSyncAt)}</Text>

      {connection.status === 'CONNECTED' ? (
        <>
          <Button
            title={state === 'submitting' ? 'Triggering…' : 'Trigger sync now'}
            size="sm"
            variant="outline"
            onPress={handleTriggerSync}
            loading={state === 'submitting'}
          />
          {state !== 'idle' && state !== 'submitting' ? (
            <Alert variant={state === 'success' ? 'success' : 'destructive'}>
              {TRIGGER_SYNC_MESSAGE[state] ?? ''}
            </Alert>
          ) : null}
        </>
      ) : (
        <Text style={styles.mutedText}>This user has no connected Oura account to sync.</Text>
      )}

      <Text style={styles.sectionSubtitle}>Today&apos;s / most recent snapshot</Text>
      {todaySnapshot ? (
        <View style={styles.metricsGrid}>
          <MetricStat label="Sleep score" value={todaySnapshot.sleepScore} />
          <MetricStat label="Readiness score" value={todaySnapshot.readinessScore} />
          <MetricStat label="Activity score" value={todaySnapshot.activityScore} />
          <MetricStat label="Total sleep" value={todaySnapshot.totalSleepMinutes} unit="min" />
          <MetricStat label="Resting HR" value={todaySnapshot.restingHeartRate} unit="bpm" />
          <MetricStat label="Average HRV" value={todaySnapshot.averageHrv} unit="ms" />
          <MetricStat label="Steps" value={todaySnapshot.steps} />
        </View>
      ) : (
        <Text style={styles.mutedText}>No health metrics recorded for this user yet.</Text>
      )}
    </Card>
  );
}

function SyncJobsCard({ jobs }: { jobs: AdminUserDetail['recentSyncJobs'] }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Recent sync jobs</Text>
      {jobs.length === 0 ? (
        <Text style={styles.mutedText}>No sync jobs recorded for this user yet.</Text>
      ) : (
        <ScrollView horizontal style={styles.tableScroll}>
          <View>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              {['Type', 'Status', 'Started', 'Finished', 'Records', 'Error'].map((h) => (
                <Text key={h} style={styles.tableHeaderCell}>
                  {h}
                </Text>
              ))}
            </View>
            {jobs.map((job) => (
              <View key={job.id} style={styles.tableRow}>
                <Text style={styles.tableCell}>{job.type}</Text>
                <Text style={[styles.tableCell, { color: SYNC_JOB_STATUS_COLOR[job.status] ?? colors.foreground }]}>
                  {job.status}
                </Text>
                <Text style={styles.tableCell}>{formatDateTime(job.startedAt)}</Text>
                <Text style={styles.tableCell}>{formatDateTime(job.finishedAt)}</Text>
                <Text style={styles.tableCell}>
                  {job.recordsFetched}/{job.recordsCreated}/{job.recordsUpdated}
                </Text>
                <Text style={styles.tableCell}>{job.errorMessage ?? job.errorCode ?? '—'}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </Card>
  );
}

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminUserDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    getAdminUserDetail(id)
      .then(setDetail)
      .catch(() => setError('Could not load this user.'));
  }, [id]);

  useEffect(load, [load]);

  if (detail === undefined) {
    return (
      <View style={styles.centered}>
        {error ? <Alert variant="destructive">{error}</Alert> : <ActivityIndicator color={colors.primary.default} />}
      </View>
    );
  }

  if (detail === null) {
    return (
      <View style={styles.centered}>
        <Alert variant="destructive">This user could not be found.</Alert>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Alert variant="info">{`Admin view — viewing ${detail.user.fullName ?? detail.user.email}`}</Alert>

      <AccountCard user={detail.user} />

      <CreatorStatusCard
        accountType={detail.user.accountType}
        onChanged={(next) => setDetail((prev) => (prev ? { ...prev, user: { ...prev.user, accountType: next } } : prev))}
      />

      <OuraConnectionCard detail={detail} />

      <SyncJobsCard jobs={detail.recentSyncJobs} />
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
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    gap: 10,
  },
  cardTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 16,
    color: colors.foreground,
  },
  fieldRow: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.foreground,
  },
  warningText: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  mutedText: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  statusBadge: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 14,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontFamily: fontFamily.sansMedium,
    fontSize: 13,
    color: colors.foreground,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricStat: {
    width: '30%',
  },
  metricLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.muted.foreground,
  },
  metricValue: {
    marginTop: 2,
    fontFamily: fontFamily.sansSemibold,
    fontSize: 17,
    color: colors.foreground,
  },
  metricUnit: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  tableScroll: {
    marginTop: 0,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.card.border,
    paddingVertical: 8,
  },
  tableHeaderRow: {
    borderBottomWidth: 2,
  },
  tableHeaderCell: {
    width: 90,
    fontFamily: fontFamily.sansMedium,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  tableCell: {
    width: 90,
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.foreground,
  },
});
