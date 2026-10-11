import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamily, radii } from '@/src/theme/tokens';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Compact segmented switch used at the top of the four main areas
 * (Today: Today | Trends | Body, Me > About me: Personal | Exercise | Nutrition, ...).
 * Equal-width segments, one selected; same look on phone and desktop web.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.muted.default,
    borderRadius: radii.xl,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radii.xl - 4 },
  segmentActive: { backgroundColor: colors.card.default },
  label: { fontFamily: fontFamily.sansMedium, fontSize: 14, color: colors.muted.foreground },
  labelActive: { color: colors.primary.default, fontFamily: fontFamily.sansSemibold },
});
