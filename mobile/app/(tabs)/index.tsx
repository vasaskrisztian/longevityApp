import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getDashboardSnapshot, type DashboardSnapshot } from '@/src/api/dashboard';
import { getConnections, type ConnectionSummary } from '@/src/api/wearables';
import { getProfileBundle } from '@/src/api/profile';
import { Card } from '@/src/components/ui/Card';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Real data, phase 17 — replaces the ScreenStub. Deliberately not full
 * parity with the web app's dashboard/page.tsx yet: the protocol-target
 * overlays ("Following: X protocol", target lines under each score, the
 * weekly-workouts card) depend on screens phase 20 hasn't ported yet
 * (Protocols) and a count the mobile API doesn't expose on its own
 * (getWeeklyWorkoutCount has no route). Core metrics — the actual point of
 * "Dashboard + Trends" — are real here: Sleep/Readiness/Activity/HRV/
 * Resting HR/Sleep duration/Steps, wired to the same /api/dashboard route
 * the web app's server component calls directly (mobile reaches it over
 * HTTP via the phase 16 Bearer auth instead).
 */

function formatSleepDuration(totalMinutes: number | null): string | null {
  if (totalMinutes === null) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function ScoreCard({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <Card style={styles.scoreCard}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>
        {value === null ? '—' : value}
        {value !== null && unit ? <Text style={styles.scoreUnit}> {unit}</Text> : null}
      </Text>
      {value === null ? <Text style={styles.scoreHint}>No data yet</Text> : null}
    </Card>
  );
}

interface DashboardState {
  snapshot: DashboardSnapshot | null;
  ouraConnection: ConnectionSummary | null;
  firstName: string | null;
}

export default function DashboardScreen() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [snapshot, connections, profileBundle] = await Promise.all([
        getDashboardSnapshot(),
        getConnections(),
        getProfileBundle(),
      ]);
      setState({
        snapshot,
        ouraConnection: connections.find((c) => c.provider === 'OURA') ?? null,
        firstName: profileBundle.profile?.fullName?.split(' ')[0] ?? null,
      });
    } catch {
      setError('Could not load your dashboard. Pull down to try again.');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary.default} />
      </View>
    );
  }

  const snapshot = state?.snapshot ?? null;
  const connection = state?.ouraConnection ?? null;
  const sleepDuration = formatSleepDuration(snapshot?.totalSleepMinutes ?? null);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <View>
        <Text style={styles.title}>{state?.firstName ? `Hi, ${state.firstName}` : 'Dashboard'}</Text>
        <Text style={styles.subtitle}>
          {connection?.status === 'CONNECTED'
            ? `Oura: connected${connection.lastSyncAt ? ` · last synced ${new Date(connection.lastSyncAt).toLocaleString()}` : ''}`
            : 'No wearable connected yet.'}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {snapshot && !snapshot.isToday ? (
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            No data has synced for today yet — showing the most recent day available (
            {new Date(snapshot.date).toLocaleDateString()}).
          </Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <ScoreCard label="Sleep" value={snapshot?.sleepScore ?? null} />
        <ScoreCard label="Readiness" value={snapshot?.readinessScore ?? null} />
        <ScoreCard label="Activity" value={snapshot?.activityScore ?? null} />
      </View>

      <View style={styles.row}>
        <ScoreCard label="HRV" value={snapshot?.averageHrv ?? null} unit="ms" />
        <ScoreCard label="Resting HR" value={snapshot?.restingHeartRate ?? null} unit="bpm" />
      </View>

      <View style={styles.row}>
        <Card style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Sleep duration</Text>
          <Text style={styles.scoreValue}>{sleepDuration ?? '—'}</Text>
          {!sleepDuration ? <Text style={styles.scoreHint}>No data yet</Text> : null}
        </Card>
        <ScoreCard label="Steps" value={snapshot?.steps ?? null} />
      </View>

      <ScoreCard
        label="Active calories (today)"
        value={snapshot?.activeCalories ?? null}
        unit="kcal"
      />

      {!snapshot ? (
        <Card>
          <Text style={styles.emptyTitle}>No wellness data yet</Text>
          <Text style={styles.emptyBody}>
            {connection?.status === 'CONNECTED'
              ? 'Your Oura Ring is connected — the first sync populates this dashboard once it runs.'
              : 'Connect your Oura Ring to start seeing Sleep, Readiness and Activity scores here.'}
          </Text>
        </Card>
      ) : null}

      <Text style={styles.disclaimer}>
        This platform provides wellness information and does not provide medical diagnoses or
        medical advice.
      </Text>
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
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    color: colors.foreground,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  scoreCard: {
    flex: 1,
  },
  scoreLabel: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  scoreValue: {
    marginTop: 6,
    fontFamily: fontFamily.sansSemibold,
    fontSize: 28,
    color: colors.foreground,
  },
  scoreUnit: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    color: colors.muted.foreground,
  },
  scoreHint: {
    marginTop: 4,
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  errorBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: '#FBEAE9',
    padding: 12,
  },
  errorText: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.danger,
  },
  infoBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.card.border,
    backgroundColor: colors.muted.default,
    padding: 12,
  },
  infoText: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  emptyTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 16,
    color: colors.foreground,
  },
  emptyBody: {
    marginTop: 4,
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  disclaimer: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.muted.foreground,
  },
});
