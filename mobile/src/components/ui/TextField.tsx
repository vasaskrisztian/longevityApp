import { StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle, type TextInputProps } from 'react-native';

import { colors, fontFamily, radii } from '@/src/theme/tokens';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  /** Outer layout only (e.g. `{ flex: 1 }` to sit two-up in a row) — same
   * convention as Button's `style` prop. The TextInput itself always keeps
   * its own border/padding/typography; there's no way to override those
   * per call site, same as Button never lets `style` touch its colors. */
  style?: StyleProp<ViewStyle>;
}

export function TextField({ label, error, style, ...props }: TextFieldProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted.foreground}
        // The visible label is a separate <Text>, so without this a screen reader
        // (VoiceOver/TalkBack) announces an unlabeled text box.
        accessibilityLabel={label}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 13,
    color: colors.foreground,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: fontFamily.sans,
    color: colors.foreground,
    backgroundColor: colors.card.default,
  },
  error: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.danger,
  },
});
