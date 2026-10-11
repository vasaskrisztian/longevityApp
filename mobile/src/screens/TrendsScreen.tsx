import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDeviceDataVersion } from '@/src/health/deviceSyncStore';
import { getTrends, type TrendPoint, type TrendRangeDays } from '@/src/api/dashboard';
import { Card } from '@/src/components/ui/Card';
import { LineChart, type LineChartSeries } from '@/src/components/charts/LineChart';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Real data, phase 17 — replaces the ScreenStub. Mirrors the web app's
 * trends/trend-charts.tsx: same range toggle (7/30 days), same five charts
 * (combined Scores line chart + four single-metric charts), same
 * "connectNulls" line behavior, same per-series colors (dataviz skill:
 * validated CVD-safe palette, fixed series order, never reassigned) — just
 * rendered with LineChart (react-native-svg) instead of recharts, which
 * doesn't run on native. A "show table" toggle mirrors the web version's
 * accessible data table.
 */

const SLEEP_COLOR = '#2a78d6';
const READINESS_COLOR = '#eb6834';
const ACTIVITY_COLOR = '#1baf7a';
const METRIC_COLOR = colors.primary.default;

const RANGES: TrendRangeDays[] = [7, 30];

function formatDateLabel(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function hasAnyData(points: TrendPoint[]): boolean {
  return points.some(
    (p) =>
      p.sleepScore !== null ||
      p.readinessScore !== null ||
      p.activityScore !== null ||
      p.totalSleepMinutes !== null ||
      p.restingHeartRate !== null ||
      p.averageHrv !== null ||
      p.steps !== null,
  );
}

function ChartCard({
  title,
  description,
  points,
  series,
}: {
  title: string;
  description: string;
  points: TrendPoint[];
  series: LineChartSeries[];
}) {
  const labels = useMemo(() => points.map((p) => formatDateLabel(p.date)), [points]);
  return (
    <Card>
      <Text style={styles.chartTitle}>{title}</Text>
      <Text style={styles.chartDescription}>{description}</Text>
      {hasAnyData(points) ? (
        <View style={styles.chartBody}>
          <LineChart labels={labels} series={series} />
          {series.length > 1 ? (
            <View style={styles.legendRow}>
              {series.map((s) => (
                <View key={s.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                  <Text style={styles.legendLabel}>{s.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyChartText}>No data for this range yet.</Text>
        </View>
      )}
    </Card>
  );
}

export default function TrendsScreen() {
  const [range, setRange] = useState<TrendRangeDays>(7);
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  // Goes up when the login-time device sync has brought in new data: reload quietly (no spinner).
  const deviceDataVersion = useDeviceDataVersion();
  const lastLoad = useRef<{ range: TrendRangeDays; version: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The first load and range changes show the spinner; only a device-sync bump of the same range is quiet.
    const previous = lastLoad.current;
    const silent = previous !== null && previous.range === range && previous.version !== deviceDataVersion;
    lastLoad.current = { range, version: deviceDataVersion };
    if (!silent) setLoading(true);
    setError(null);
    getTrends(range)
      .then((data) => {
        if (!cancelled) setPoints(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this range. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, deviceDataVersion]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.title}>Trends</Text>
        <Text style={styles.subtitle}>
          Sleep, readiness and activity scores, HRV, resting heart rate, sleep duration and steps
          over the last 7 or 30 days.
        </Text>
      </View>

      <View style={styles.controlsRow}>
        <View style={styles.rangeGroup}>
          {RANGES.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={[styles.rangeButton, r === range && styles.rangeButtonActive]}
            >
              <Text style={[styles.rangeButtonText, r === range && styles.rangeButtonTextActive]}>
                {r}-day
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.tableToggle} onPress={() => setShowTable((v) => !v)}>
          <Text style={styles.tableToggleText}>{showTable ? 'Hide table' : 'Show as table'}</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary.default} />
        </View>
      ) : (
        <View style={styles.chartsStack}>
          <ChartCard
            title="Scores"
            description="Sleep, readiness and activity — higher is better, 0-100."
            points={points}
            series={[
              { key: 'sleepScore', name: 'Sleep', color: SLEEP_COLOR, values: points.map((p) => p.sleepScore) },
              {
                key: 'readinessScore',
                name: 'Readiness',
                color: READINESS_COLOR,
                values: points.map((p) => p.readinessScore),
              },
              {
                key: 'activityScore',
                name: 'Activity',
                color: ACTIVITY_COLOR,
                values: points.map((p) => p.activityScore),
              },
            ]}
          />

          <ChartCard
            title="HRV"
            description="Average heart rate variability (ms)."
            points={points}
            series={[{ key: 'averageHrv', name: 'HRV', color: METRIC_COLOR, values: points.map((p) => p.averageHrv) }]}
          />

          <ChartCard
            title="Resting heart rate"
            description="Beats per minute."
            points={points}
            series={[
              {
                key: 'restingHeartRate',
                name: 'Resting HR',
                color: METRIC_COLOR,
                values: points.map((p) => p.restingHeartRate),
              },
            ]}
          />

          <ChartCard
            title="Sleep duration"
            description="Total sleep, in minutes."
            points={points}
            series={[
              {
                key: 'totalSleepMinutes',
                name: 'Sleep duration',
                color: METRIC_COLOR,
                values: points.map((p) => p.totalSleepMinutes),
              },
            ]}
          />

          <ChartCard
            title="Steps"
            description="Daily step count."
            points={points}
            series={[{ key: 'steps', name: 'Steps', color: METRIC_COLOR, values: points.map((p) => p.steps) }]}
          />
        </View>
      )}

      {showTable && !loading ? (
        <Card>
          <Text style={styles.chartTitle}>Data table</Text>
          <Text style={styles.chartDescription}>
            The same values shown in the charts above, for accessibility or export.
          </Text>
          <ScrollView horizontal style={styles.tableScroll}>
            <View>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                {['Date', 'Sleep', 'Readiness', 'Activity', 'HRV', 'Resting HR', 'Sleep min', 'Steps'].map(
                  (h) => (
                    <Text key={h} style={styles.tableHeaderCell}>
                      {h}
                    </Text>
                  ),
                )}
              </View>
              {points.map((p) => (
                <View key={p.date} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{p.date}</Text>
                  <Text style={styles.tableCell}>{p.sleepScore ?? '—'}</Text>
                  <Text style={styles.tableCell}>{p.readinessScore ?? '—'}</Text>
                  <Text style={styles.tableCell}>{p.activityScore ?? '—'}</Text>
                  <Text style={styles.tableCell}>{p.averageHrv ?? '—'}</Text>
                  <Text style={styles.tableCell}>{p.restingHeartRate ?? '—'}</Text>
                  <Text style={styles.tableCell}>{p.totalSleepMinutes ?? '—'}</Text>
                  <Text style={styles.tableCell}>{p.steps ?? '—'}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </Card>
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
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rangeGroup: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: 12,
    padding: 4,
    backgroundColor: colors.card.default,
  },
  rangeButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  rangeButtonActive: {
    backgroundColor: colors.primary.default,
  },
  rangeButtonText: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  rangeButtonTextActive: {
    color: colors.primary.foreground,
  },
  tableToggle: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  tableToggleText: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 13,
    color: colors.foreground,
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
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  chartsStack: {
    gap: 16,
  },
  chartTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 16,
    color: colors.foreground,
  },
  chartDescription: {
    marginTop: 2,
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  chartBody: {
    marginTop: 12,
  },
  emptyChart: {
    marginTop: 12,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  tableScroll: {
    marginTop: 12,
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
