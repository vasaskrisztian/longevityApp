import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle, type PressableProps } from 'react-native';

import { colors, fontFamily, radii } from '@/src/theme/tokens';

type Variant = 'primary' | 'outline' | 'destructive' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Outer layout only (e.g. `{ flex: 1 }` to sit in a button row) — never
   * used to override the variant's own colors/padding. */
  style?: StyleProp<ViewStyle>;
}

/**
 * The one button shape every form on this app needs (previously inlined
 * ad hoc in login.tsx/profile.tsx) — factored out now that phase 18's
 * several CRUD screens (Goals, Supplements, Lifestyle, Nutrition,
 * onboarding) all need save/cancel/delete/add buttons side by side.
 */
export function Button({ title, variant = 'primary', size = 'md', loading, disabled, style, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sizeSm : styles.sizeMd,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'destructive' ? colors.primary.foreground : colors.primary.default} />
      ) : (
        <Text style={[styles.text, size === 'sm' && styles.textSm, textVariantStyles[variant]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sizeMd: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  sizeSm: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 15,
  },
  textSm: {
    fontSize: 13,
  },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primary.default },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.card.border },
  destructive: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent' },
});

const textVariantStyles = StyleSheet.create({
  primary: { color: colors.primary.foreground },
  outline: { color: colors.foreground },
  destructive: { color: '#FFFFFF' },
  ghost: { color: colors.primary.default },
});
