import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamily, radii } from '@/src/theme/tokens';

type Variant = 'success' | 'destructive' | 'info';

export function Alert({ variant, children }: { variant: Variant; children: string }) {
  return (
    <View style={[styles.base, variantStyles[variant]]}>
      <Text style={[styles.text, textVariantStyles[variant]]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 12,
  },
  text: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
  },
});

const variantStyles = StyleSheet.create({
  success: { backgroundColor: '#E8F5EE', borderColor: colors.success },
  destructive: { backgroundColor: '#FBEAE9', borderColor: colors.danger },
  info: { backgroundColor: colors.muted.default, borderColor: colors.card.border },
});

const textVariantStyles = StyleSheet.create({
  success: { color: colors.success },
  destructive: { color: colors.danger },
  info: { color: colors.muted.foreground },
});
