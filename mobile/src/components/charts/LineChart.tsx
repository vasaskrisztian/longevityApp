import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line as SvgLine, Path, Text as SvgText } from 'react-native-svg';

import { colors, fontFamily } from '@/src/theme/tokens';

import { defaultValueLabel, placeTooltip } from './chartFormat';

/**
 * A small, hand-rolled line chart built directly on react-native-svg rather
 * than a higher-level charting library (victory-native, react-native-gifted-
 * charts, react-native-chart-kit). Every one of those either targets native
 * only or ships a *separate* web package rather than genuinely supporting
 * react-native-web — a real problem for this app specifically, since the
 * Expo/RN-Web rewrite (claude/phase-15-mobile-migration-plan.md) is meant to
 * eventually replace the desktop web app too, so "doesn't render on web" is
 * disqualifying, not a minor gap. react-native-svg is Expo's own
 * first-party, genuinely cross-platform (iOS/Android/Web) primitive — it
 * renders real `<svg>` DOM nodes on web — so building directly on it avoids
 * betting this on a third party's uncertain web story. The chart itself
 * mirrors the web app's trend-charts.tsx: same "connectNulls" behavior
 * (bridge the line across a gap instead of breaking it), same mark spec
 * (2px lines, small dot markers), same per-series colors.
 */

export interface LineChartSeries {
  key: string;
  name: string;
  color: string;
  values: Array<number | null>;
  /** Draw the line dashed (e.g. a target line). */
  dashed?: boolean;
  /** Dot markers on the points; default true. */
  markers?: boolean;
}

interface LineChartProps {
  labels: string[];
  series: LineChartSeries[];
  height?: number;
  yMin?: number;
  yMax?: number;
  formatY?: (value: number) => string;
  /** How a value reads in the tooltip; defaults to whole numbers, else one decimal. */
  formatValue?: (value: number) => string;
  /** Fuller x labels for the tooltip (e.g. with the weekday); defaults to `labels`. */
  tooltipLabels?: string[];
}

interface ActivePoint {
  index: number;
  seriesKey: string;
}

const HIT_SIZE = 26;
const TIP_ROW_HEIGHT = 16;

const PADDING = { top: 10, right: 12, bottom: 20, left: 38 };
/** Approximate width of one y-tick character at the tick font size. */
const TICK_CHAR_WIDTH = 6;
const GRID_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;
const TICK_PROPS = {
  fontFamily: fontFamily.sans,
  fontSize: 10,
  fill: colors.muted.foreground,
} as const;

export function LineChart({
  labels,
  series,
  height = 180,
  yMin,
  yMax,
  formatY,
  formatValue,
  tooltipLabels,
}: LineChartProps) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<ActivePoint | null>(null);

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const allValues = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const domainMin = yMin ?? (allValues.length ? Math.min(0, ...allValues) : 0);
  const rawMax = yMax ?? (allValues.length ? Math.max(...allValues) : 1);
  const domainMax = rawMax <= domainMin ? domainMin + 1 : rawMax;

  const tickFormatter = formatY ?? ((value: number) => String(Math.round(value)));
  // Room for the widest y label ("7h 30m", "14700"), so none is clipped at the left edge.
  const widestTick = Math.max(...GRID_STEPS.map((t) => tickFormatter(domainMin + (domainMax - domainMin) * t).length));
  const padLeft = Math.max(PADDING.left, widestTick * TICK_CHAR_WIDTH + 12);
  const innerWidth = Math.max(width - padLeft - PADDING.right, 0);
  const innerHeight = height - PADDING.top - PADDING.bottom;
  // At most ~5 x-axis labels regardless of range (7 or 30 points), so a
  // 30-day view doesn't crowd every date label on top of the next one.
  const labelStep = Math.max(1, Math.ceil(labels.length / 5));

  function xAt(index: number): number {
    if (labels.length <= 1) return padLeft + innerWidth / 2;
    return padLeft + (innerWidth * index) / (labels.length - 1);
  }

  function yAt(value: number): number {
    const t = (value - domainMin) / (domainMax - domainMin);
    return PADDING.top + innerHeight * (1 - t);
  }

  function pathFor(values: Array<number | null>): string {
    let d = '';
    let started = false;
    values.forEach((value, index) => {
      if (value === null) return;
      const x = xAt(index);
      const y = yAt(value);
      d += started ? ` L ${x} ${y}` : `M ${x} ${y}`;
      started = true;
    });
    return d;
  }

  const valueLabel = formatValue ?? defaultValueLabel;
  // Hit areas are as wide as the point spacing allows, so neighbouring points never swallow each other.
  const spacing = labels.length > 1 ? innerWidth / (labels.length - 1) : HIT_SIZE;
  const hitWidth = Math.max(12, Math.min(HIT_SIZE, spacing));

  const activeSeries = active ? series.find((s) => s.key === active.seriesKey) : undefined;
  const activeValue = active && activeSeries ? activeSeries.values[active.index] : null;
  const activePoint =
    active && activeSeries && activeValue !== null && activeValue !== undefined
      ? { index: active.index, value: activeValue, color: activeSeries.color }
      : null;

  let tooltip: {
    box: { left: number; top: number };
    size: { width: number; height: number };
    title: string;
    rows: Array<{ key: string; name: string; color: string; text: string }>;
  } | null = null;
  if (activePoint) {
    const rows = series
      .map((s) => ({ s, v: s.values[activePoint.index] }))
      .filter((r): r is { s: LineChartSeries; v: number } => r.v !== null && r.v !== undefined)
      .map(({ s, v }) => ({ key: s.key, name: s.name, color: s.color, text: valueLabel(v) }));
    const title = (tooltipLabels ?? labels)[activePoint.index] ?? '';
    const longest = Math.max(title.length, ...rows.map((r) => r.name.length + 2 + r.text.length));
    const size = { width: Math.min(Math.max(96, longest * 6.6 + 34), Math.max(width, 96)), height: 12 + 16 + rows.length * TIP_ROW_HEIGHT };
    tooltip = {
      box: placeTooltip({ x: xAt(activePoint.index), y: yAt(activePoint.value) }, size, { width, height }),
      size,
      title,
      rows,
    };
  }

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {GRID_STEPS.map((t) => {
            const y = PADDING.top + innerHeight * (1 - t);
            const value = domainMin + (domainMax - domainMin) * t;
            return (
              <G key={t}>
                <SvgLine
                  x1={padLeft}
                  x2={width - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke={colors.card.border}
                  strokeWidth={1}
                />
                <SvgText x={padLeft - 6} y={y + 3} textAnchor="end" {...TICK_PROPS}>
                  {tickFormatter(value)}
                </SvgText>
              </G>
            );
          })}

          {labels.map((label, index) => {
            if (index % labelStep !== 0 && index !== labels.length - 1) return null;
            return (
              <SvgText
                key={label + index}
                x={xAt(index)}
                y={height - 4}
                textAnchor={index === labels.length - 1 && labels.length > 1 ? 'end' : 'middle'}
                {...TICK_PROPS}
              >
                {label}
              </SvgText>
            );
          })}

          {series.map((s) => (
            <Path
              key={s.key}
              d={pathFor(s.values)}
              stroke={s.color}
              strokeWidth={2}
              fill="none"
              strokeDasharray={s.dashed ? '5 5' : undefined}
            />
          ))}

          {series.map((s) =>
            s.values.map((value, index) =>
              value === null || s.markers === false ? null : (
                <Circle
                  key={`${s.key}-${index}`}
                  cx={xAt(index)}
                  cy={yAt(value)}
                  r={3}
                  fill={s.color}
                />
              ),
            ),
          )}
          {activePoint ? (
            <Circle
              cx={xAt(activePoint.index)}
              cy={yAt(activePoint.value)}
              r={6}
              fill="none"
              stroke={activePoint.color}
              strokeWidth={2}
            />
          ) : null}
        </Svg>
      )}

      {width > 0 ? (
        <>
          {/* Behind the hit areas: hovering the empty chart (or tapping it on a phone) closes the tooltip. */}
          <Pressable
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={() => setActive(null)}
            onHoverIn={() => setActive(null)}
          />
          {/* One hit area per measured point: the tooltip only appears on real data points. */}
          {series.flatMap((s) =>
            s.values.map((value, index) =>
              value === null ? null : (
                <Pressable
                  key={`hit-${s.key}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${(tooltipLabels ?? labels)[index]}: ${s.name} ${valueLabel(value)}`}
                  onPress={() => setActive({ index, seriesKey: s.key })}
                  onHoverIn={() => setActive({ index, seriesKey: s.key })}
                  style={{
                    position: 'absolute',
                    left: xAt(index) - hitWidth / 2,
                    top: yAt(value) - HIT_SIZE / 2,
                    width: hitWidth,
                    height: HIT_SIZE,
                  }}
                />
              ),
            ),
          )}

          {tooltip ? (
            <View pointerEvents="none" style={[styles.tooltip, { left: tooltip.box.left, top: tooltip.box.top, width: tooltip.size.width }]}>
              <Text style={styles.tooltipTitle}>{tooltip.title}</Text>
              {tooltip.rows.map((row) => (
                <View key={row.key} style={styles.tooltipRow}>
                  <View style={[styles.tooltipDot, { backgroundColor: row.color }]} />
                  <Text style={styles.tooltipText} numberOfLines={1}>
                    {row.name}: {row.text}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.card.border,
    backgroundColor: colors.card.default,
    shadowColor: '#10181B',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tooltipTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 12,
    color: colors.foreground,
    marginBottom: 2,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: TIP_ROW_HEIGHT,
  },
  tooltipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltipText: {
    flexShrink: 1,
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.foreground,
  },
});
