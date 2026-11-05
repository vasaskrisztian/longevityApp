import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CollectiveSeries, GroupChallengeType } from '@/src/api/groups';
import { LineChart } from '@/src/components/charts/LineChart';
import { useT } from '@/src/i18n';
import { colors, fontFamily } from '@/src/theme/tokens';
import { collectiveAmountLabel, compactAmount, formatAmount } from '@/src/wellbeing/format';
import { teamChartModel } from '@/src/wellbeing/teamChart';

/**
 * The team's running total per day against the shared target (dashed line).
 * One data series, so the heading names it; "Show as table" gives the same
 * numbers as text.
 */
export function TeamChart({ type, series }: { type: GroupChallengeType; series: CollectiveSeries }) {
  const { t } = useT();
  const [showTable, setShowTable] = useState(false);
  if (series.points.length === 0) {
    return <Text style={styles.muted}>{t('wellbeing.chart.empty')}</Text>;
  }
  const model = teamChartModel(series);
  const last = series.points[series.points.length - 1]!;
  const manyPoints = series.points.length > 31;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('wellbeing.chart.title')}</Text>
        <Pressable accessibilityRole="button" onPress={() => setShowTable((value) => !value)}>
          <Text style={styles.toggle}>{showTable ? t('wellbeing.chart.hideTable') : t('wellbeing.chart.showTable')}</Text>
        </Pressable>
      </View>
      <View
        accessibilityRole="image"
        accessibilityLabel={t('wellbeing.chart.a11y', {
          total: collectiveAmountLabel(type, last.cumulative),
          target: collectiveAmountLabel(type, series.targetTotal),
        })}
      >
        <LineChart
          labels={model.labels}
          yMin={0}
          yMax={model.yMax}
          formatY={compactAmount}
          series={[
            { key: 'target', name: t('wellbeing.chart.target'), color: colors.muted.foreground, values: model.targets, dashed: true, markers: false },
            { key: 'total', name: t('wellbeing.chart.teamTotal'), color: colors.primary.default, values: model.totals, markers: !manyPoints },
          ]}
        />
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.primary.default }]} />
          <Text style={styles.legendText}>{t('wellbeing.chart.teamTotal')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.swatchDashed, { borderColor: colors.muted.foreground }]} />
          <Text style={styles.legendText}>{t('wellbeing.chart.targetAmount', { amount: formatAmount(series.targetTotal) })}</Text>
        </View>
      </View>
      {showTable ? (
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.head]}>{t('wellbeing.chart.day')}</Text>
            <Text style={[styles.cell, styles.head, styles.num]}>{t('wellbeing.chart.thatDay')}</Text>
            <Text style={[styles.cell, styles.head, styles.num]}>{t('wellbeing.chart.teamTotal')}</Text>
          </View>
          {series.points.map((point) => (
            <View key={point.date} style={styles.row}>
              <Text style={styles.cell}>{point.date}</Text>
              <Text style={[styles.cell, styles.num]}>{formatAmount(point.amount)}</Text>
              <Text style={[styles.cell, styles.num]}>{formatAmount(point.cumulative)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontFamily: fontFamily.sansMedium, fontSize: 13, color: colors.foreground },
  toggle: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground, textDecorationLine: 'underline' },
  muted: { fontFamily: fontFamily.sans, fontSize: 13, color: colors.muted.foreground },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 3, borderRadius: 2 },
  swatchDashed: { backgroundColor: 'transparent', borderTopWidth: 2, borderStyle: 'dashed', height: 0 },
  legendText: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground },
  table: { gap: 2 },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: colors.card.border },
  cell: { flex: 1, fontFamily: fontFamily.sans, fontSize: 13, color: colors.foreground },
  head: { fontFamily: fontFamily.sansMedium, color: colors.muted.foreground },
  num: { textAlign: 'right' },
});
