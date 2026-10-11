import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/src/components/ui/Card';
import { colors, fontFamily } from '@/src/theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface HubItem {
  label: string;
  description?: string;
  icon: IconName;
  onPress: () => void;
}

/** A card of tappable rows (icon, label, one-line description, chevron) — the hub pattern of Plan and Me. */
export function HubList({ items }: { items: HubItem[] }) {
  return (
    <Card style={styles.card}>
      {items.map((item, index) => (
        <View key={item.label}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <Pressable accessibilityRole="button" onPress={item.onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Ionicons name={item.icon} size={22} color={colors.primary.default} />
            <View style={styles.text}>
              <Text style={styles.label}>{item.label}</Text>
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted.foreground} />
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  label: { fontFamily: fontFamily.sansMedium, fontSize: 15, color: colors.foreground },
  description: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.muted.foreground },
  divider: { height: 1, backgroundColor: colors.card.border },
});
