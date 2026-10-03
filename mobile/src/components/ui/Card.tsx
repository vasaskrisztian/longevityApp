import { View, StyleSheet, type ViewProps } from 'react-native';

import { colors, radii } from '@/src/theme/tokens';

/**
 * The one recurring visual shape across every screen so far (profile.tsx
 * inlined its own card-less layout; dashboard/trends are the first screens
 * that need several of these side by side) — mirrors the web app's
 * `components/ui/card.tsx` (white surface, 1px border, rounded corners).
 * Kept deliberately minimal (no CardHeader/CardTitle split like the web
 * version) since no screen needs that structure yet; add it if phase 18
 * does rather than guessing the shape now.
 */
export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card.default,
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: radii.xl,
    padding: 16,
  },
});
