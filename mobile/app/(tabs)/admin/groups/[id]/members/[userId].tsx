import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { getGroupMemberHealth, type MemberHealth } from '@/src/api/groups';
import { Alert } from '@/src/components/ui/Alert';
import { Card } from '@/src/components/ui/Card';
import { LineChart, type LineChartSeries } from '@/src/components/charts/LineChart';
import { colors, fontFamily } from '@/src/theme/tokens';
import { displayName, formatDay, minutesToHoursLabel, providerLabel, timeAgo } from '@/src/wellbeing/format';

/**
 * Corporate wellbeing — admin: one member's health data. Only people who
 * joined this group (and consented) can be opened; every open is audited
 * server-side. Mirrors what the admin user detail shows (today's/most recent
 * snapshot, devices) and adds the 30-day trend and the raw recent workouts,
 * so a surprising workout count can be checked against where it came from.
 */

const SLEEP_COLOR = '#2F4A38';
const READINESS_COLOR = '#8F6224';
const ACTIVITY_COLOR = '#4B6A8A';

function Stat({ label, value, unit }: { label: string; value: number | string | null; unit?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value === null ? '—' : value}
        {value !== null && unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
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

export default function MemberHealthScreen() {
  const { id, userId } = useLocalSearchParams<{ id: string; userId: string }>();
  const [data, setData] = useState<MemberHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !userId) return;
    getGroupMemberHealth(id, userId)
      .then(setData)
      .catch(() => setError('Could not load this member’s data. They may have left the group.'));
  }, [id, userId]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Alert variant="destructive">{error}</Alert>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary.default} />
      </View>
    );
  }

  const { snapshot, trend } = data;
  const labels = trend.map((p) => formatDay(p.date).replace(/ \d{4}$/, ''));
  const scoreSeries: LineChartSeries[] = [
    { key: 'sleep', name: 'Sleep', color: SLEEP_COLOR, values: trend.map((p) => p.sleepScore) },
    { key: 'readiness', name: 'Readiness', color: READINESS_COLOR, values: trend.map((p) => p.readinessScore) },
    { key: 'activity', name: 'Activity', color: ACTIVITY_COLOR, values: trend.map((p) => p.activityScore) },
  ];
  const hasTrend = trend.some((p) => p.sleepScore !== null || p.steps !== null || p.readinessScore !== null || p.activityScore !== null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.title}>{displayName(data.member)}</Text>
        {data.member.fullName ? <Text style={styles.muted}>{data.member.email}</Text> : null}
        <Text style={styles.muted}>In the group since {formatDay(data.member.joinedAt.slice(0, 10))}</Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Devices</Text>
        {data.connections.length === 0 ? <Text style={styles.muted}>No device connected.</Text> : null}
        {data.connections.map((connection) => (
          <Text key={connection.provider} style={styles.body}>
            {providerLabel(connection.provider)} · {CONNECTION_LABEL[connection.status] ?? connection.status} ·{' '}
            {connection.lastSyncAt ? `last sync ${timeAgo(connection.lastSyncAt)}` : 'never synced'}
          </Text>
        ))}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{snapshot?.isToday ? 'Today' : 'Most recent day'}</Text>
        {snapshot ? (
          <>
            <Text style={styles.muted}>
              {formatDay(snapshot.date)}
              {snapshot.sourceProviders.length ? ` · ${snapshot.sourceProviders.map(providerLabel).join(', ')}` : ''}
            </Text>
            <View style={styles.grid}>
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
          <Text style={styles.muted}>No health data recorded yet.</Text>
        )}
      </Card>

      {hasTrend ? (
        <>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Scores — last 30 days</Text>
            <LineChart labels={labels} series={scoreSeries} yMin={0} yMax={100} />
            <View style={styles.legend}>
              {scoreSeries.map((s) => (
                <View key={s.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                  <Text style={styles.muted}>{s.name}</Text>
                </View>
              ))}
            </View>
          </Card>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Steps — last 30 days</Text>
            <LineChart
              labels={labels}
              series={[{ key: 'steps', name: 'Steps', color: SLEEP_COLOR, values: trend.map((p) => p.steps) }]}
              yMin={0}
            />
          </Card>
        </>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Workouts</Text>
        <Text style={styles.body}>
          {data.weeklyWorkouts} in the last 7 days{' '}
          <Text style={styles.muted}>(sessions of at least 10 minutes; auto-detected walks are not counted)</Text>
        </Text>
        {data.recentWorkouts.length === 0 ? <Text style={styles.muted}>No workouts in the last 14 days.</Text> : null}
        {data.recentWorkouts.map((workout, index) => (
          <View key={`${workout.startedAt}-${index}`} style={styles.workoutRow}>
            <Text style={[styles.body, styles.flex]}>
              {workout.activityType.replace(/_/g, ' ')} · {workout.durationMin} min
            </Text>
            <Text style={styles.muted}>
              {new Date(workout.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ·{' '}
              {providerLabel(workout.provider)}
              {workout.source ? ` (${workout.source})` : ''}
            </Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14 },
  centered: { flex: 1, backgroundColor: colors.background, padding: 20, justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },
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
