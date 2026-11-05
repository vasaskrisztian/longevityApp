import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  connectionStatusLabel,
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
import { locale, t, useT } from '@/src/i18n';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { enumLabel } from '@/src/validation/schemas';
import { chartDayLabel, displayName, formatDay, minutesToHoursLabel, providerLabel, timeAgo } from '@/src/wellbeing/format';

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
  return iso ? new Date(iso).toLocaleString(locale()) : '—';
}

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

function triggerSyncMessage(state: TriggerSyncState): string {
  switch (state) {
    case 'success':
      return t('admin.person.oura.queued');
    case 'rate_limited':
      return t('admin.person.oura.rateLimited');
    case 'not_connected':
      return t('admin.person.oura.notConnected');
    case 'error':
      return t('admin.person.oura.triggerFailed');
    default:
      return '';
  }
}

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
  const { t } = useT();
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('admin.person.account.title')}</Text>
      <Text style={styles.fieldRow}>{t('admin.person.account.email', { value: user.email })}</Text>
      <Text style={styles.fieldRow}>{t('admin.person.account.role', { value: user.role })}</Text>
      <Text style={styles.fieldRow}>{t('admin.person.account.status', { value: user.status })}</Text>
      <Text style={styles.fieldRow}>
        {t('admin.person.account.emailVerified', {
          value: user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : t('common.no'),
        })}
      </Text>
      <Text style={styles.fieldRow}>{t('admin.person.account.lastLogin', { value: formatDateTime(user.lastLoginAt) })}</Text>
      <Text style={styles.fieldRow}>{t('admin.person.account.joined', { value: formatDateTime(user.createdAt) })}</Text>
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
  const { t } = useT();
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
      setError(t('admin.person.creator.updateFailed'));
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('admin.person.creator.title')}</Text>
      <Text style={styles.fieldRow}>{t('admin.person.creator.accountType', { value: accountType })}</Text>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {isCreator ? (
        <Text style={styles.warningText}>{t('admin.person.creator.revokeWarning')}</Text>
      ) : null}
      <Button
        title={
          updating ? t('admin.person.creator.updating') : isCreator ? t('admin.person.creator.revoke') : t('admin.person.creator.grant')
        }
        size="sm"
        variant={isCreator ? 'destructive' : 'primary'}
        onPress={handlePress}
        loading={updating}
      />
    </Card>
  );
}

function OuraConnectionCard({ id, detail }: { id: string; detail: AdminUserDetail }) {
  const { t } = useT();
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
      <Text style={styles.cardTitle}>{t('admin.person.oura.title')}</Text>
      <Text style={[styles.statusBadge, { color: CONNECTION_STATUS_COLOR[connection.status] ?? colors.foreground }]}>
        {connectionStatusLabel(connection.status)}
      </Text>
      <Text style={styles.fieldRow}>{t('admin.person.oura.lastSync', { value: formatDateTime(connection.lastSyncAt) })}</Text>

      {connection.status === 'CONNECTED' ? (
        <>
          <Button
            title={state === 'submitting' ? t('admin.person.oura.triggering') : t('admin.person.oura.trigger')}
            size="sm"
            variant="outline"
            onPress={handleTriggerSync}
            loading={state === 'submitting'}
          />
          {state !== 'idle' && state !== 'submitting' ? (
            <Alert variant={state === 'success' ? 'success' : 'destructive'}>
              {triggerSyncMessage(state)}
            </Alert>
          ) : null}
        </>
      ) : (
        <Text style={styles.mutedText}>{t('admin.person.oura.notConnected')}</Text>
      )}

      <Text style={styles.sectionSubtitle}>{t('admin.person.oura.snapshotTitle')}</Text>
      {todaySnapshot ? (
        <View style={styles.metricsGrid}>
          <MetricStat label={t('admin.person.metric.sleepScore')} value={todaySnapshot.sleepScore} />
          <MetricStat label={t('admin.person.metric.readinessScore')} value={todaySnapshot.readinessScore} />
          <MetricStat label={t('admin.person.metric.activityScore')} value={todaySnapshot.activityScore} />
          <MetricStat label={t('admin.person.metric.totalSleep')} value={todaySnapshot.totalSleepMinutes} unit="min" />
          <MetricStat label={t('admin.person.metric.restingHr')} value={todaySnapshot.restingHeartRate} unit="bpm" />
          <MetricStat label={t('admin.person.metric.averageHrv')} value={todaySnapshot.averageHrv} unit="ms" />
          <MetricStat label={t('admin.person.metric.steps')} value={todaySnapshot.steps} />
        </View>
      ) : (
        <Text style={styles.mutedText}>{t('admin.person.oura.noMetrics')}</Text>
      )}
    </Card>
  );
}

function SyncJobsCard({ jobs }: { jobs: AdminUserDetail['recentSyncJobs'] }) {
  const { t } = useT();
  const headers = [
    t('admin.person.syncJobs.type'),
    t('admin.person.syncJobs.status'),
    t('admin.person.syncJobs.started'),
    t('admin.person.syncJobs.finished'),
    t('admin.person.syncJobs.records'),
    t('admin.person.syncJobs.error'),
  ];
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('admin.person.syncJobs.title')}</Text>
      {jobs.length === 0 ? (
        <Text style={styles.mutedText}>{t('admin.person.syncJobs.empty')}</Text>
      ) : (
        <ScrollView horizontal style={styles.tableScroll}>
          <View>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              {headers.map((h) => (
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


type Segment = 'health' | 'devices' | 'account';

/** Group-consented health: devices summary, today, 30-day charts, workouts. */
function MemberHealthSection({ data }: { data: MemberHealth }) {
  const { t, locale } = useT();
  const { snapshot, trend } = data;
  const labels = trend.map((p) => chartDayLabel(p.date));
  const scoreSeries: LineChartSeries[] = [
    { key: 'sleep', name: t('admin.person.metric.sleep'), color: SLEEP_COLOR, values: trend.map((p) => p.sleepScore) },
    { key: 'readiness', name: t('admin.person.metric.readiness'), color: READINESS_COLOR, values: trend.map((p) => p.readinessScore) },
    { key: 'activity', name: t('admin.person.metric.activity'), color: ACTIVITY_COLOR, values: trend.map((p) => p.activityScore) },
  ];
  const hasTrend = trend.some((p) => p.sleepScore !== null || p.steps !== null || p.readinessScore !== null || p.activityScore !== null);

  return (
    <>
      <Card style={h.card}>
        <Text style={h.cardTitle}>{t('admin.person.health.devices')}</Text>
        {data.connections.length === 0 ? <Text style={h.muted}>{t('admin.person.health.noDevice')}</Text> : null}
        {data.connections.map((connection) => (
          <Text key={connection.provider} style={h.body}>
            {t('admin.person.health.deviceLine', {
              provider: providerLabel(connection.provider),
              status: connectionStatusLabel(connection.status),
              sync: connection.lastSyncAt
                ? t('admin.person.health.lastSync', { when: timeAgo(connection.lastSyncAt) })
                : t('admin.person.health.neverSynced'),
            })}
          </Text>
        ))}
      </Card>

      <Card style={h.card}>
        <Text style={h.cardTitle}>{snapshot?.isToday ? t('admin.person.health.today') : t('admin.person.health.mostRecentDay')}</Text>
        {snapshot ? (
          <>
            <Text style={h.muted}>
              {formatDay(snapshot.date)}
              {snapshot.sourceProviders.length ? ` · ${snapshot.sourceProviders.map(providerLabel).join(', ')}` : ''}
            </Text>
            <View style={h.grid}>
              <Stat label={t('admin.person.metric.sleepScore')} value={snapshot.sleepScore} />
              <Stat label={t('admin.person.metric.readiness')} value={snapshot.readinessScore} />
              <Stat label={t('admin.person.metric.activity')} value={snapshot.activityScore} />
              <Stat
                label={t('admin.person.metric.sleep')}
                value={snapshot.totalSleepMinutes === null ? null : minutesToHoursLabel(snapshot.totalSleepMinutes)}
              />
              <Stat label={t('admin.person.metric.restingHr')} value={snapshot.restingHeartRate} unit="bpm" />
              <Stat label={t('admin.person.metric.hrv')} value={snapshot.averageHrv} unit="ms" />
              <Stat label={t('admin.person.metric.steps')} value={snapshot.steps} />
              <Stat label={t('admin.person.metric.activeKcal')} value={snapshot.activeCalories} />
            </View>
          </>
        ) : (
          <Text style={h.muted}>{t('admin.person.health.noData')}</Text>
        )}
      </Card>

      {hasTrend ? (
        <>
          <Card style={h.card}>
            <Text style={h.cardTitle}>{t('admin.person.health.scores30')}</Text>
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
            <Text style={h.cardTitle}>{t('admin.person.health.steps30')}</Text>
            <LineChart
              labels={labels}
              series={[{ key: 'steps', name: t('admin.person.metric.steps'), color: SLEEP_COLOR, values: trend.map((p) => p.steps) }]}
              yMin={0}
            />
          </Card>
        </>
      ) : null}

      <Card style={h.card}>
        <Text style={h.cardTitle}>{t('admin.person.health.workouts')}</Text>
        <Text style={h.body}>
          {t('admin.person.health.workoutsWeek', { count: data.weeklyWorkouts })}{' '}
          <Text style={h.muted}>{t('admin.person.health.workoutsNote')}</Text>
        </Text>
        {data.recentWorkouts.length === 0 ? <Text style={h.muted}>{t('admin.person.health.noWorkouts')}</Text> : null}
        {data.recentWorkouts.map((workout, index) => (
          <View key={`${workout.startedAt}-${index}`} style={h.workoutRow}>
            <Text style={[h.body, h.flex]}>
              {t('admin.person.health.workoutLine', { activity: enumLabel(workout.activityType), minutes: workout.durationMin })}
            </Text>
            <Text style={h.muted}>
              {new Date(workout.startedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ·{' '}
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
function SnapshotSection({ detail }: { detail: AdminUserDetail }) {
  const { t } = useT();
  const snapshot = detail.todaySnapshot;
  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{snapshot?.isToday ? t('admin.person.health.today') : t('admin.person.health.mostRecentDay')}</Text>
      {snapshot ? (
        <View style={styles.metricsGrid}>
          <MetricStat label={t('admin.person.metric.sleepScore')} value={snapshot.sleepScore} />
          <MetricStat label={t('admin.person.metric.readinessScore')} value={snapshot.readinessScore} />
          <MetricStat label={t('admin.person.metric.activityScore')} value={snapshot.activityScore} />
          <MetricStat label={t('admin.person.metric.totalSleep')} value={snapshot.totalSleepMinutes} unit="min" />
          <MetricStat label={t('admin.person.metric.restingHr')} value={snapshot.restingHeartRate} unit="bpm" />
          <MetricStat label={t('admin.person.metric.averageHrv')} value={snapshot.averageHrv} unit="ms" />
          <MetricStat label={t('admin.person.metric.steps')} value={snapshot.steps} />
        </View>
      ) : (
        <Text style={styles.mutedText}>{t('admin.person.health.snapshotNoMetrics')}</Text>
      )}
      <Text style={styles.mutedText}>{t('admin.person.health.snapshotNote')}</Text>
    </Card>
  );
}

export default function PersonScreen({ userId, groupId }: { userId: string; groupId?: string }) {
  const { t } = useT();
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
      .catch(() => setMemberError(t('admin.person.memberLoadFailed')));
  }, [groupId, userId, t]);

  const loadDetail = useCallback(() => {
    getAdminUserDetail(userId)
      .then(setDetail)
      .catch(() => setDetailError(t('admin.person.accountLoadFailed')));
  }, [userId, t]);

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
        <Alert variant="destructive">{t('admin.person.notFound')}</Alert>
      ) : (
        <ActivityIndicator color={colors.primary.default} />
      );
    }
  } else if (detailError) {
    body = <Alert variant="destructive">{detailError}</Alert>;
  } else if (detailPending) {
    body = <ActivityIndicator color={colors.primary.default} />;
  } else if (detail === null) {
    body = <Alert variant="destructive">{t('admin.person.notFound')}</Alert>;
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
          <Text style={h.title}>{name || t('admin.person.fallbackName')}</Text>
          {email ? <Text style={h.muted}>{email}</Text> : null}
          {member ? <Text style={h.muted}>{t('admin.person.groupSince', { date: formatDay(member.member.joinedAt.slice(0, 10)) })}</Text> : null}
        </View>
        <SegmentedControl
          options={[
            { value: 'health', label: t('admin.person.segment.health') },
            { value: 'devices', label: t('admin.person.segment.devices') },
            { value: 'account', label: t('admin.person.segment.account') },
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
