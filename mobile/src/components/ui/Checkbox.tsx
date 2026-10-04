import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * React Native has no built-in checkbox. A plain Pressable row with an
 * accessible checkbox role/state — same "no third-party widget dependency"
 * stance as the Chip selectors (phase 18) — keeps this working identically
 * on native and react-native-web.
 */
export function Checkbox({
  label,
  checked,
  onChange,
  error,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  error?: string;
}) {
  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => onChange(!checked)}
        style={styles.row}
      >
        <View style={[styles.box, checked && styles.boxChecked]}>
          {checked ? <Text style={styles.tick}>✓</Text> : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.card.border,
    backgroundColor: colors.card.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary.default, borderColor: colors.primary.default },
  tick: { color: colors.primary.foreground, fontSize: 14, lineHeight: 16, fontFamily: fontFamily.sansSemibold },
  label: { flex: 1, fontFamily: fontFamily.sans, fontSize: 14, color: colors.foreground },
  error: { fontFamily: fontFamily.sans, fontSize: 12, color: colors.danger },
});
