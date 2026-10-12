import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getAdminUserDetail,
  setAccountType,
  triggerSync,
  type AdminAccountType,
  type AdminUserDetail,
} from '@/src/api/admin';
import { getGroupMemberHealth, type MemberHealth } from '@/src/api/groups';
import { ScreenBackdrop } from '@/src/components/AppBackdrop';
import { LineChart, type LineChartSeries } from '@/src/components/charts/LineChart';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { displayName, formatDay, minutesToHoursLabel, providerLabel, timeAgo } from '@/src/wellbeing/format';

/**
 * Admin: ONE view of ONE person, whichever way the admin got here.
 *
 * - Opened from a group (`groupId` given): "Health" shows what that group's
 *   member consented to share (today, 30-day trends, recent workouts; the
 *   server checks membership + consent and audits the read).
 * - Opened from the Users list (no `groupId`): there is no group consent to
 *   lean on, so "Health" shows only today's / the most recent snapshot that
 *   the account detail already returns.
 * - "Devices" (Oura connection, sync trigger, recent sync jobs) and
 *   "Account" (account facts, creator status) come from the account detail,
 *   which writes an ADMIN_VIEW_USER audit row every time it is loaded — so it
 *   is fetched only when a segment that needs it is actually opened (for the
 *   no-group case that is the first screen, since Health needs the snapshot).
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
  id,
  accountType,
  onChanged,
}: {
  id: string;
  accountType: string;
  onChanged: (next: AdminAccountType) => void;
}) {
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

function OuraConnectionCard({ id, detail }: { id: string; detail: AdminUserDetail }) {
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


const SLEEP_COLOR = '#2F4A38';
const READINESS_COLOR = '#8F6224';
const ACTIVITY_COLOR = '#4B6A8A';

function Stat({ label, value, unit }: { label: string; value: number | string | null; unit?: string }) {
  return (
    <View style={h.stat}>
      <Text style={h.statLabel}>{label}</Text>
      <Text style={h.statValue}>
        {value === null ? '—' : value}
        {value !== null && unit ? <Text style={h.statUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

const CONNECTION_LABEL: Record<string, string> = {
  CONNECTED: 'Connected',
  DISCONNECTED: 'Not connected',
  AUTH_REQUIRED: 'Reconnect required',
  ERROR: 'Connection error',
};


type Segment = 'health' | 'devices' | 'account';

/** Group-consented health: devices summary, today, 30-day charts, workouts. */
function MemberHealthSection({ data }: { data: MemberHealth }) {
  const { snapshot, trend } = data;
  const labels = trend.map((p) => formatDay(p.date).replace(/ \d{4}$/, ''));
  const scoreSeries: LineChartSeries[] = [
    { key: 'sleep', name: 'Sleep', color: SLEEP_COLOR, values: trend.map((p) => p.sleepScore) },
    { key: 'readiness', name: 'Readiness', color: READINESS_COLOR, values: trend.map((p) => p.readinessScore) },
    { key: 'activity', name: 'Activity', color: ACTIVITY_COLOR, values: trend.map((p) => p.activityScore) },
  ];
  const hasTrend = trend.some((p) => p.sleepScore !== null || p.steps !== null || p.readinessScore !== null || p.activityScore !== null);

  return (
    <>
      <Card style={h.card}>
        <Text style={h.cardTitle}>Devices</Text>
        {data.connections.length === 0 ? <Text style={h.muted}>No device connected.</Text> : null}
        {data.connections.map((connection) => (
          <Text key={connection.provider} style={h.body}>
            {providerLabel(connection.provider)} · {CONNECTION_LABEL[connection.status] ?? connection.status} ·{' '}
            {connection.lastSyncAt ? `last sync ${timeAgo(connection.lastSyncAt)}` : 'never synced'}
          </Text>
        ))}
      </Card>

      <Card style={h.card}>
        <Text style={h.cardTitle}>{snapshot?.isToday ? 'Today' : 'Most recent day'}</Text>
        {snapshot ? (
          <>
            <Text style={h.muted}>
              {formatDay(snapshot.date)}
              {snapshot.sourceProviders.length ? ` · ${snapshot.sourceProviders.map(providerLabel).join(', ')}` : ''}
            </Text>
            <View style={h.grid}>
              <Stat label="Sleep score" value={snapshot.sleepScore} />
              <Stat label="Readiness" value={snapshot.readinessScore} />
              <Stat label="Activity" value={snapshot.activityScore} />
              <Stat label="Sleep" value={snapshot.totalSleepMinutes === null ? null : minutesToHoursLabel(snapshot.totalSleepMinutes)} />
              <Stat label="Resting HR" value={snapshot.restingHeartRate} unit="bpm" />
              <Stat label="HRV" value={snapshot.averageHrv} unit="ms" />
              <Stat label="Steps" value={snapshot.steps} />
              <Stat label="Active kcal" value={snapshot.activeCalories} />
            </View>
          </>
        ) : (
          <Text style={h.muted}>No health data recorded yet.</Text>
        )}
      </Card>

      {hasTrend ? (
        <>
          <Card style={h.card}>
            <Text style={h.cardTitle}>Scores — last 30 days</Text>
            <LineChart labels={labels} series={scoreSeries} yMin={0} yMax={100} />
            <View style={h.legend}>
              {scoreSeries.map((s) => (
                <View key={s.key} style={h.legendItem}>
                  <View style={[h.legendDot, { backgroundColor: s.color }]} />
                  <Text style={h.muted}>{s.name}</Text>
                </View>
              ))}
            </View>
          </Card>
          <Card style={h.card}>
            <Text style={h.cardTitle}>Steps — last 30 days</Text>
            <LineChart
              labels={labels}
              series={[{ key: 'steps', name: 'Steps', color: SLEEP_COLOR, values: trend.map((p) => p.steps) }]}
              yMin={0}
            />
          </Card>
        </>
      ) : null}

      <Card style={h.card}>
        <Text style={h.cardTitle}>Workouts</Text>
        <Text style={h.body}>
          {data.weeklyWorkouts} in the last 7 days{' '}
          <Text style={h.muted}>(sessions of at least 10 minutes; auto-detected walks are not counted)</Text>
        </Text>
        {data.recentWorkouts.length === 0 ? <Text style={h.muted}>No workouts in the last 14 days.</Text> : null}
        {data.recentWorkouts.map((workout, index) => (
          <View key={`${workout.startedAt}-${index}`} style={h.workoutRow}>
            <Text style={[h.body, h.flex]}>
              {workout.activityType.replace(/_/g, ' ')} · {workout.durationMin} min
            </Text>
            <Text style={h.muted}>
              {new Date(workout.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ·{' '}
              {providerLabel(workout.provider)}
              {workout.source ? ` (${workout.source})` : ''}
            </Text>
          </View>
        ))}
      </Card>
    </>
  );
}

/** What the account detail alone can say about health: the latest snapshot. */
function SnapshotSection({ detail }: { detail: AdminUserDetail } ) {
  const snapshot = detail.todaySnapshot;
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{snapshot?.isToday ? 'Today' : 'Most recent day'}</Text>
      {snapshot ? (
        <View style={styles.metricsGrid}>
          <MetricStat label="Sleep score" value={snapshot.sleepScore} />
          <MetricStat label="Readiness score" value={snapshot.readinessScore} />
          <MetricStat label="Activity score" value={snapshot.activityScore} />
          <MetricStat label="Total sleep" value={snapshot.totalSleepMinutes} unit="min" />
          <MetricStat label="Resting HR" value={snapshot.restingHeartRate} unit="bpm" />
          <MetricStat label="Average HRV" value={snapshot.averageHrv} unit="ms" />
          <MetricStat label="Steps" value={snapshot.steps} />
        </View>
      ) : (
        <Text style={styles.mutedText}>No health metrics recorded for this person yet.</Text>
      )}
      <Text style={styles.mutedText}>
        Trends and workouts are visible only through a group the person has joined and consented to share with.
      </Text>
    </Card>
  );
}

export default function PersonScreen({ userId, groupId }: { userId: string; groupId?: string }) {
  const inGroup = Boolean(groupId);
  const [segment, setSegment] = useState<Segment>('health');
  const [member, setMember] = useState<MemberHealth | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null | undefined>(undefined);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRequested, setDetailRequested] = useState(!inGroup);

  useEffect(() => {
    if (!groupId) return;
    getGroupMemberHealth(groupId, userId)
      .then(setMember)
      .catch(() => setMemberError('Could not load this member’s data. They may have left the group.'));
  }, [groupId, userId]);

  const loadDetail = useCallback(() => {
    getAdminUserDetail(userId)
      .then(setDetail)
      .catch(() => setDetailError('Could not load this person’s account.'));
  }, [userId]);

  useEffect(() => {
    if (detailRequested) loadDetail();
  }, [detailRequested, loadDetail]);

  function select(next: Segment) {
    setSegment(next);
    if (next !== 'health') setDetailRequested(true);
  }

  const name = member ? displayName(member.member) : detail ? (detail.user.fullName ?? detail.user.email) : '';
  const email = member?.member.fullName ? member.member.email : detail?.user.fullName ? detail.user.email : null;

  const detailPending = detailRequested && detail === undefined;
  let body: React.ReactNode;
  if (segment === 'health') {
    if (inGroup) {
      body = memberError ? (
        <Alert variant="destructive">{memberError}</Alert>
      ) : member ? (
        <MemberHealthSection data={member} />
      ) : (
        <ActivityIndicator color={colors.primary.default} />
      );
    } else {
      body = detailError ? (
        <Alert variant="destructive">{detailError}</Alert>
      ) : detail ? (
        <SnapshotSection detail={detail} />
      ) : detail === null ? (
        <Alert variant="destructive">This person could not be found.</Alert>
      ) : (
        <ActivityIndicator color={colors.primary.default} />
      );
    }
  } else if (detailError) {
    body = <Alert variant="destructive">{detailError}</Alert>;
  } else if (detailPending) {
    body = <ActivityIndicator color={colors.primary.default} />;
  } else if (detail === null) {
    body = <Alert variant="destructive">This person could not be found.</Alert>;
  } else if (detail) {
    body =
      segment === 'devices' ? (
        <>
          <OuraConnectionCard id={userId} detail={detail} />
          <SyncJobsCard jobs={detail.recentSyncJobs} />
        </>
      ) : (
        <>
          <AccountCard user={detail.user} />
          <CreatorStatusCard
            id={userId}
            accountType={detail.user.accountType}
            onChanged={(next) =>
              setDetail((prev) => (prev ? { ...prev, user: { ...prev.user, accountType: next } } : prev))
            }
          />
        </>
      );
  }

  return (
    <View style={styles.container}>
      <ScreenBackdrop />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View>
          <Text style={h.title}>{name || 'Person'}</Text>
          {email ? <Text style={h.muted}>{email}</Text> : null}
          {member ? <Text style={h.muted}>In the group since {formatDay(member.member.joinedAt.slice(0, 10))}</Text> : null}
        </View>
        <SegmentedControl
          options={[
            { value: 'health', label: 'Health' },
            { value: 'devices', label: 'Devices' },
            { value: 'account', label: 'Account' },
          ]}
          value={segment}
          onChange={select}
        />
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: screenBackground,
  },
  scroll: { flex: 1 },
  content: {
    padding: 20,
    gap: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: screenBackground,
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

const h = StyleSheet.create({
  container: { flex: 1, backgroundColor: screenBackground },
  content: { padding: 20, gap: 14 },
  centered: { flex: 1, backgroundColor: screenBackground, padding: 20, justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },
  accountButton: { alignSelf: 'flex-start', marginTop: 10 },
  title: { fontFamily: fontFamily.display, fontSize: 24, color: colors.foreground },
  card: { gap: 10 },
  cardTitle: { fontFamily: fontFamily.sansSemibold, fontSize: 16, color: colors.foreground },
  body: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.foreground, lineHeight: 20 },
  muted: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '47%', gap: 2 },
  statLabel: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground },
  statValue: { fontFamily: fontFamily.display, fontSize: 20, color: colors.foreground },
  statUnit: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground },
  legend: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.card.border,
  },
});
