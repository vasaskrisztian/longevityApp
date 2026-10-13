import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDeviceDataVersion } from '@/src/health/deviceSyncStore';
import { getTrends, type TrendPoint, type TrendRangeDays } from '@/src/api/dashboard';
import { Card } from '@/src/components/ui/Card';
import { LineChart, type LineChartSeries } from '@/src/components/charts/LineChart';
import { durationAxisMax, durationLabel } from '@/src/components/charts/chartFormat';
import { InfoLabel } from '@/src/components/ui/InfoLabel';
import type { GlossaryKey } from '@/src/content/glossary';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { niceAxisMax } from '@/src/wellbeing/format';

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

function formatTooltipDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** The three score series, in their fixed order and colors (never reassigned when some are hidden). */
const SCORE_SERIES = [
  { key: 'sleepScore', name: 'Sleep', color: SLEEP_COLOR },
  { key: 'readinessScore', name: 'Readiness', color: READINESS_COLOR },
  { key: 'activityScore', name: 'Activity', color: ACTIVITY_COLOR },
] as const;
type ScoreKey = (typeof SCORE_SERIES)[number]['key'];

/** A round axis top a little above the data maximum, so the gridlines read cleanly (e.g. 12000, 8000). */
function niceMax(values: Array<number | null>): number {
  const max = values.reduce<number>((acc, v) => (v !== null && v > acc ? v : acc), 0);
  return niceAxisMax(max * 1.05);
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
  term,
  description,
  points,
  series,
  legend,
  yMin,
  yMax,
  formatY,
  formatValue,
}: {
  title: string;
  /** Glossary entry explained by the "i" next to the title. */
  term?: GlossaryKey;
  description: string;
  points: TrendPoint[];
  series: LineChartSeries[];
  /** Replaces the default legend (the Scores card uses it for its series toggles). */
  legend?: ReactNode;
  yMin?: number;
  yMax?: number;
  formatY?: (value: number) => string;
  formatValue?: (value: number) => string;
}) {
  const labels = useMemo(() => points.map((p) => formatDateLabel(p.date)), [points]);
  const tooltipLabels = useMemo(() => points.map((p) => formatTooltipDate(p.date)), [points]);
  return (
    <Card>
      {term ? (
        <InfoLabel term={term} textStyle={styles.chartTitle}>
          {title}
        </InfoLabel>
      ) : (
        <Text style={styles.chartTitle}>{title}</Text>
      )}
      <Text style={styles.chartDescription}>{description}</Text>
      {hasAnyData(points) ? (
        <View style={styles.chartBody}>
          {legend ? <View style={styles.legendTop}>{legend}</View> : null}
          <LineChart
            labels={labels}
            tooltipLabels={tooltipLabels}
            series={series}
            yMin={yMin}
            yMax={yMax}
            formatY={formatY}
            formatValue={formatValue}
          />
          {!legend && series.length > 1 ? (
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

/** Toggle chips for the score series: any one, two or all three can be on, never none. */
function ScoreToggles({ selected, onToggle }: { selected: ScoreKey[]; onToggle: (key: ScoreKey) => void }) {
  return (
    <View style={styles.toggleRow}>
      {SCORE_SERIES.map((s) => {
        const on = selected.includes(s.key);
        return (
          <Pressable
            key={s.key}
            onPress={() => onToggle(s.key)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${s.name} score`}
            style={[styles.toggleChip, on && styles.toggleChipOn]}
          >
            <View style={[styles.toggleDot, { backgroundColor: on ? s.color : colors.card.border }]} />
            <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{s.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TrendsScreen() {
  const [range, setRange] = useState<TrendRangeDays>(7);
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [scoreKeys, setScoreKeys] = useState<ScoreKey[]>(SCORE_SERIES.map((s) => s.key));

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

  function toggleScore(key: ScoreKey) {
    setScoreKeys((current) => {
      if (!current.includes(key)) return SCORE_SERIES.map((s) => s.key).filter((k) => k === key || current.includes(k));
      // Keep at least one score on the chart.
      return current.length > 1 ? current.filter((k) => k !== key) : current;
    });
  }

  const scoreSeries: LineChartSeries[] = SCORE_SERIES.filter((s) => scoreKeys.includes(s.key)).map((s) => ({
    key: s.key,
    name: s.name,
    color: s.color,
    values: points.map((p) => p[s.key]),
  }));
  const sleepDurations = points.map((p) => p.totalSleepMinutes);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View>
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
            term="scores"
            description="Sleep, readiness and activity — higher is better, 0-100. Tap a name to show or hide it."
            points={points}
            series={scoreSeries}
            yMin={0}
            yMax={100}
            legend={<ScoreToggles selected={scoreKeys} onToggle={toggleScore} />}
          />

          <ChartCard
            title="HRV"
            term="hrv"
            description="Average heart rate variability (ms)."
            points={points}
            yMin={0}
            yMax={niceMax(points.map((p) => p.averageHrv))}
            series={[{ key: 'averageHrv', name: 'HRV', color: METRIC_COLOR, values: points.map((p) => p.averageHrv) }]}
          />

          <ChartCard
            title="Resting heart rate"
            term="restingHr"
            description="Beats per minute."
            points={points}
            yMin={0}
            yMax={niceMax(points.map((p) => p.restingHeartRate))}
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
            term="sleepDuration"
            description="Total sleep, in hours and minutes."
            points={points}
            yMin={0}
            yMax={durationAxisMax(sleepDurations)}
            formatY={durationLabel}
            formatValue={durationLabel}
            series={[
              {
                key: 'totalSleepMinutes',
                name: 'Sleep duration',
                color: METRIC_COLOR,
                values: sleepDurations,
              },
            ]}
          />

          <ChartCard
            title="Steps"
            term="steps"
            description="Daily step count."
            points={points}
            yMin={0}
            yMax={niceMax(points.map((p) => p.steps))}
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
                {['Date', 'Sleep', 'Readiness', 'Activity', 'HRV', 'Resting HR', 'Sleep time', 'Steps'].map(
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
                  <Text style={styles.tableCell}>{p.totalSleepMinutes === null ? '—' : durationLabel(p.totalSleepMinutes)}</Text>
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
    backgroundColor: screenBackground,
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
  // Selected range: forest green with a thin gold edge (same pairing as the chips).
  rangeButtonActive: {
    backgroundColor: colors.primary.default,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent.light,
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
  legendTop: {
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.card.border,
    backgroundColor: colors.card.default,
  },
  toggleChipOn: {
    backgroundColor: colors.primary.default,
    borderColor: colors.accent.light,
  },
  toggleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  toggleText: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  toggleTextOn: {
    color: colors.primary.foreground,
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
