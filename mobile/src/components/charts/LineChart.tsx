import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line as SvgLine, Path, Text as SvgText } from 'react-native-svg';

import { colors, fontFamily } from '@/src/theme/tokens';

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
}

const PADDING = { top: 10, right: 12, bottom: 20, left: 38 };
const GRID_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;
const TICK_PROPS = {
  fontFamily: fontFamily.sans,
  fontSize: 10,
  fill: colors.muted.foreground,
} as const;

export function LineChart({ labels, series, height = 180, yMin, yMax, formatY }: LineChartProps) {
  const [width, setWidth] = useState(0);

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const allValues = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const domainMin = yMin ?? (allValues.length ? Math.min(0, ...allValues) : 0);
  const rawMax = yMax ?? (allValues.length ? Math.max(...allValues) : 1);
  const domainMax = rawMax <= domainMin ? domainMin + 1 : rawMax;

  const innerWidth = Math.max(width - PADDING.left - PADDING.right, 0);
  const innerHeight = height - PADDING.top - PADDING.bottom;
  const tickFormatter = formatY ?? ((value: number) => String(Math.round(value)));
  // At most ~5 x-axis labels regardless of range (7 or 30 points), so a
  // 30-day view doesn't crowd every date label on top of the next one.
  const labelStep = Math.max(1, Math.ceil(labels.length / 5));

  function xAt(index: number): number {
    if (labels.length <= 1) return PADDING.left + innerWidth / 2;
    return PADDING.left + (innerWidth * index) / (labels.length - 1);
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
                  x1={PADDING.left}
                  x2={width - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke={colors.card.border}
                  strokeWidth={1}
                />
                <SvgText x={PADDING.left - 6} y={y + 3} textAnchor="end" {...TICK_PROPS}>
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
        </Svg>
      )}
    </View>
  );
}
