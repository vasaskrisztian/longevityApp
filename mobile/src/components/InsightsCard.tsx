import { StyleSheet, Text, View } from 'react-native';

import type { Insights, InsightSeverity } from '@/src/api/dashboard';
import { Card } from '@/src/components/ui/Card';
import { InfoLabel } from '@/src/components/ui/InfoLabel';
import { colors, fontFamily } from '@/src/theme/tokens';

const SEVERITY: Record<InsightSeverity, { color: string; label: string }> = {
  attention: { color: colors.warning, label: 'Watch' },
  good: { color: colors.success, label: 'Good' },
  info: { color: colors.muted.foreground, label: 'Note' },
};

/**
 * The Today screen's daily summary: a one-line headline plus the few things
 * that differ from the person's own usual values or protocol targets. The
 * severity is always spelled out as a label next to the colored dot, so it
 * never relies on color alone.
 */
export function InsightsCard({ insights }: { insights: Insights }) {
  return (
    <Card style={styles.card} testID="insights-card">
      <InfoLabel term="baseline" textStyle={styles.kicker}>
        Your day at a glance
      </InfoLabel>
      <Text style={styles.headline}>{insights.headline}</Text>
      {insights.items.map((item) => {
        const tone = SEVERITY[item.severity];
        return (
          <View key={item.key} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: tone.color }]} />
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle}>
                {item.title} <Text style={styles.itemTag}>· {tone.label}</Text>
              </Text>
              <Text style={styles.itemMessage}>{item.message}</Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
  },
  kicker: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  headline: {
    fontFamily: fontFamily.display,
    fontSize: 20,
    color: colors.foreground,
  },
  item: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  dot: {
    marginTop: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 14,
    color: colors.foreground,
  },
  itemTag: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  itemMessage: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
});
