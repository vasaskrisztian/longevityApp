import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  getDashboardSnapshot,
  getInsights,
  getProtocolOverlay,
  type DashboardSnapshot,
  type Insights,
  type ProtocolOverlay,
} from '@/src/api/dashboard';
import { getConnections, type ConnectionSummary } from '@/src/api/wearables';
import { getProfileBundle } from '@/src/api/profile';
import { useDeviceDataVersion, useDeviceSyncing } from '@/src/health/deviceSyncStore';
import { Button } from '@/src/components/ui/Button';
import { InsightsCard } from '@/src/components/InsightsCard';
import { Card } from '@/src/components/ui/Card';
import { InfoLabel } from '@/src/components/ui/InfoLabel';
import type { GlossaryKey } from '@/src/content/glossary';
import { useIsDesktop } from '@/src/hooks/useIsDesktop';
import { locale, t, useT } from '@/src/i18n';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { enumLabel } from '@/src/validation/schemas';

/**
 * Real data, phase 17 — replaces the ScreenStub. Phase 22's follow-up (see
 * claude/phase-15-mobile-migration-plan.md) added the protocol-target
 * overlay this screen was missing since phase 17: "Following: X protocol",
 * target lines under the Sleep/Sleep-duration/Active-calories/Workouts
 * cards, and the Workouts(7 days) card itself — all sourced from the new
 * `GET /api/dashboard/protocol-overlay` route and mirroring
 * src/app/dashboard/page.tsx's `ScoreCard`/`TargetLine` exactly (same
 * fields get targets: only `targetSleepScore`/`targetSleepMinutes`/
 * `targetWeeklyWorkouts`/`targetDailyActiveCalories` exist on the Protocol
 * model — Readiness/Activity/HRV/Resting HR/Steps never show a target,
 * same as web).
 */

function describeDevice(name: string, connection: ConnectionSummary): string {
  return connection.lastSyncAt
    ? t('dashboard.device.connectedSynced', { name, time: new Date(connection.lastSyncAt).toLocaleString(locale()) })
    : t('dashboard.device.connected', { name });
}

function formatSleepDuration(totalMinutes: number | null): string | null {
  if (totalMinutes === null) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return t('dashboard.duration', { hours, minutes });
}

/** Renders under a target-bearing card's value, e.g. "Target: 85" — never
 * rendered at all when the active protocol doesn't set that target, same
 * as the web app's TargetLine. */
function TargetLine({ target, unit }: { target: number | null | undefined; unit?: string }) {
  const { t } = useT();
  if (target === null || target === undefined) return null;
  return <Text style={styles.targetText}>{t('dashboard.target', { target: unit ? `${target} ${unit}` : target })}</Text>;
}

function ScoreCard({
  label,
  term,
  value,
  unit,
  target,
}: {
  label: string;
  /** Glossary entry explained by the "i" next to the label. */
  term: GlossaryKey;
  value: number | null;
  unit?: string;
  target?: number | null;
}) {
  const { t } = useT();
  return (
    <Card style={styles.scoreCard}>
      <InfoLabel term={term} textStyle={styles.scoreLabel}>
        {label}
      </InfoLabel>
      <Text style={styles.scoreValue}>
        {value === null ? '—' : value}
        {value !== null && unit ? <Text style={styles.scoreUnit}> {unit}</Text> : null}
      </Text>
      {target != null ? (
        <TargetLine target={target} unit={unit} />
      ) : value === null ? (
        <Text style={styles.scoreHint}>{t('dashboard.noDataYet')}</Text>
      ) : null}
    </Card>
  );
}

interface DashboardState {
  snapshot: DashboardSnapshot | null;
  ouraConnection: ConnectionSummary | null;
  appleHealthConnection: ConnectionSummary | null;
  firstName: string | null;
  protocolOverlay: ProtocolOverlay | null;
  /** null when the summary could not be loaded — the rest of the dashboard still renders. */
  insights: Insights | null;
}

export default function DashboardScreen() {
  const { t } = useT();
  const isDesktop = useIsDesktop();
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  // Goes up when the login-time device sync (health/useDeviceAutoSync) has brought in new data.
  const deviceDataVersion = useDeviceDataVersion();
  const deviceSyncing = useDeviceSyncing();

  const load = useCallback(async (isRefresh: boolean, silent = false) => {
    if (silent) {
      // Background reload after a device sync: no spinner, keep what is on screen.
    } else if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(false);
    try {
      const [snapshot, connections, profileBundle, protocolOverlay, insights] = await Promise.all([
        getDashboardSnapshot(),
        getConnections(),
        getProfileBundle(),
        getProtocolOverlay(),
        // The summary is an extra: if it fails, the score cards must still show.
        getInsights().catch(() => null),
      ]);
      setState({
        snapshot,
        ouraConnection: connections.find((c) => c.provider === 'OURA') ?? null,
        appleHealthConnection: connections.find((c) => c.provider === 'APPLE_HEALTH') ?? null,
        firstName: profileBundle.profile?.fullName?.split(' ')[0] ?? null,
        protocolOverlay,
        insights,
      });
    } catch {
      setError(true);
    } finally {
      if (silent) {
        // nothing to reset
      } else if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // First mount loads with the spinner; later bumps (fresh device data) reload silently.
    load(false, deviceDataVersion > 0);
  }, [load, deviceDataVersion]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary.default} />
      </View>
    );
  }

  const snapshot = state?.snapshot ?? null;
  const connection = state?.ouraConnection ?? null;
  const appleConnection = state?.appleHealthConnection ?? null;
  const deviceLines = [
    connection?.status === 'CONNECTED' ? describeDevice('Oura', connection) : null,
    appleConnection?.status === 'CONNECTED' ? describeDevice('Apple Health', appleConnection) : null,
  ].filter((line): line is string => line !== null);
  const activeProtocol = state?.protocolOverlay?.activeProtocol ?? null;
  const weeklyWorkoutCount = state?.protocolOverlay?.weeklyWorkoutCount ?? null;
  const sleepDuration = formatSleepDuration(snapshot?.totalSleepMinutes ?? null);
  const targetSleepDuration = formatSleepDuration(activeProtocol?.targetSleepMinutes ?? null);

  const protocolCard = activeProtocol ? (
      <Card style={styles.protocolCard}>
        <Text style={styles.protocolTitle}>{t('dashboard.protocol.following', { name: activeProtocol.name })}</Text>
        <Text style={styles.protocolDescription}>
          {activeProtocol.description || t('dashboard.protocol.defaultDescription')}
        </Text>
        {activeProtocol.supplements.length > 0 ? (
          <View style={styles.protocolSupplements}>
            <Text style={styles.protocolSupplementsLabel}>{t('dashboard.protocol.supplements')}</Text>
            {activeProtocol.supplements.map((s, i) => (
              <Text key={`${s.name}-${i}`} style={styles.protocolSupplementItem}>
                •{' '}
                {[
                  s.name,
                  s.dosage ? `— ${s.dosage}${s.unit ? ` ${s.unit}` : ''}` : null,
                  s.frequency ? `(${enumLabel(s.frequency).toLowerCase()})` : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>
    ) : null;

  const sleepDurationCard = (
    <Card style={styles.scoreCard}>
      <InfoLabel term="sleepDuration" textStyle={styles.scoreLabel}>
        {t('dashboard.card.sleepDuration')}
      </InfoLabel>
      <Text style={styles.scoreValue}>{sleepDuration ?? '—'}</Text>
      {targetSleepDuration ? (
        <Text style={styles.targetText}>{t('dashboard.target', { target: targetSleepDuration })}</Text>
      ) : !sleepDuration ? (
        <Text style={styles.scoreHint}>{t('dashboard.noDataYet')}</Text>
      ) : null}
    </Card>
  );
  const sleepCard = <ScoreCard label={t('dashboard.card.sleep')} term="sleepScore" value={snapshot?.sleepScore ?? null} target={activeProtocol?.targetSleepScore} />;
  const readinessCard = <ScoreCard label={t('dashboard.card.readiness')} term="readinessScore" value={snapshot?.readinessScore ?? null} />;
  const activityCard = <ScoreCard label={t('dashboard.card.activity')} term="activityScore" value={snapshot?.activityScore ?? null} />;
  const hrvCard = <ScoreCard label={t('dashboard.card.hrv')} term="hrv" value={snapshot?.averageHrv ?? null} unit="ms" />;
  const restingHrCard = <ScoreCard label={t('dashboard.card.restingHr')} term="restingHr" value={snapshot?.restingHeartRate ?? null} unit="bpm" />;
  const stepsCard = <ScoreCard label={t('dashboard.card.steps')} term="steps" value={snapshot?.steps ?? null} />;
  const caloriesCard = (
    <ScoreCard
      label={t('dashboard.card.activeCalories')}
      term="activeCalories"
      value={snapshot?.activeCalories ?? null}
      unit="kcal"
      target={activeProtocol?.targetDailyActiveCalories}
    />
  );
  const workoutsCard = (
    <ScoreCard
      label={t('dashboard.card.workouts')}
      term="workouts"
      value={weeklyWorkoutCount}
      target={activeProtocol?.targetWeeklyWorkouts}
    />
  );
  // Phone: 3 / 2 / 2 / 2 cards per row. Desktop (wide main column): three rows of three, grouped by theme.
  const rows = isDesktop
    ? [
        [sleepCard, readinessCard, activityCard],
        [sleepDurationCard, hrvCard, restingHrCard],
        [stepsCard, caloriesCard, workoutsCard],
      ]
    : [
        [sleepCard, readinessCard, activityCard],
        [hrvCard, restingHrCard],
        [sleepDurationCard, stepsCard],
        [caloriesCard, workoutsCard],
      ];
  const scoreRows = rows.map((cards, rowIndex) => (
    <View key={rowIndex} style={styles.row}>
      {cards.map((card, i) => (
        <View key={i} style={styles.cell}>
          {card}
        </View>
      ))}
    </View>
  ));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <View>
        <Text style={styles.title}>{state?.firstName ? t('dashboard.greeting', { name: state.firstName }) : t('dashboard.title')}</Text>
        <Text style={styles.subtitle}>
          {deviceLines.length > 0 ? deviceLines.join('\n') : t('dashboard.noWearable')}
        </Text>
        {deviceSyncing ? <Text style={styles.scoreHint}>{t('dashboard.syncing')}</Text> : null}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{t('dashboard.loadFailed')}</Text>
        </View>
      ) : null}

      {snapshot && !snapshot.isToday ? (
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            {t('dashboard.staleBanner', { date: new Date(snapshot.date).toLocaleDateString(locale()) })}
          </Text>
        </View>
      ) : null}

      {state?.insights ? <InsightsCard insights={state.insights} /> : null}

      {isDesktop ? (
        <View style={styles.desktopColumns}>
          <View style={styles.desktopMain}>{scoreRows}</View>
          {activeProtocol ? <View style={styles.desktopSide}>{protocolCard}</View> : null}
        </View>
      ) : (
        <>
          {protocolCard}
          {scoreRows}
        </>
      )}

      {!snapshot ? (
        <Card>
          <Text style={styles.emptyTitle}>{t('dashboard.empty.title')}</Text>
          <Text style={styles.emptyBody}>
            {connection?.status === 'CONNECTED'
              ? t('dashboard.empty.connected')
              : t('dashboard.empty.notConnected')}
          </Text>
          {connection?.status === 'CONNECTED' ? null : (
            <Button title={t('dashboard.empty.connect')} size="sm" style={styles.emptyButton} onPress={() => router.navigate('/devices')} />
          )}
        </Card>
      ) : null}

      <Text style={styles.disclaimer}>
        {t('dashboard.disclaimer')}
      </Text>
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
  centered: {
    flex: 1,
    backgroundColor: screenBackground,
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
  // Each card sits in a flex cell so a row of 2 or 3 splits the width evenly; the card fills its cell.
  cell: {
    flex: 1,
  },
  scoreCard: {
    flex: 1,
  },
  desktopColumns: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  desktopMain: {
    flex: 1,
    gap: 16,
  },
  desktopSide: {
    width: 300,
  },
  scoreLabel: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  targetText: {
    marginTop: 4,
    fontFamily: fontFamily.sansMedium,
    fontSize: 12,
    color: colors.accent.default,
  },
  protocolCard: {
    gap: 6,
    borderColor: colors.primary.default,
  },
  protocolTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 16,
    color: colors.foreground,
  },
  protocolDescription: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  protocolSupplements: {
    marginTop: 6,
    gap: 2,
  },
  protocolSupplementsLabel: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  protocolSupplementItem: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.foreground,
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
  emptyButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  disclaimer: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.muted.foreground,
  },
});
