import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandGradient } from '@/src/components/ui/BrandGradient';
import { isHovered } from '@/src/components/ui/hover';
import { colors, fontFamily, gradients, radii, shadows, tints } from '@/src/theme/tokens';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Compact segmented switch used at the top of the four main areas
 * (Today: Today | Trends | Body, Me > About me: Personal | Exercise | Nutrition, ...).
 * Equal-width segments, one selected; same look on phone and desktop web.
 * The selected segment wears the brand look of the old web sidebar: a forest
 * green gradient, white label, a small gold marker and a soft green glow.
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
            style={(state) => [styles.segment, active && styles.segmentActive, !active && isHovered(state) && styles.segmentHover]}
          >
            {active ? (
              <View style={styles.clip}>
                <BrandGradient colors={gradients.active} />
              </View>
            ) : null}
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
            {active ? <View style={styles.marker} /> : null}
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
  // Soft glow, a little tighter than the sidebar's so it stays inside the track.
  segmentActive: { ...shadows.glow, shadowRadius: 10, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  segmentHover: { backgroundColor: tints.gold },
  clip: { ...StyleSheet.absoluteFillObject, borderRadius: radii.xl - 4, overflow: 'hidden' },
  label: { fontFamily: fontFamily.sansMedium, fontSize: 14, color: colors.muted.foreground },
  labelActive: { color: colors.primary.foreground, fontFamily: fontFamily.sansSemibold },
  marker: { marginTop: 3, width: 14, height: 2, borderRadius: 1, backgroundColor: colors.accent.light },
});
