import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Placeholder for a screen not yet ported from the web app. Each real
 * phase (16-22, see claude/phase-15-mobile-migration-plan.md) replaces one
 * of these with the real screen wired to the live API.
 */
export function ScreenStub({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    color: colors.foreground,
  },
  note: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    color: colors.muted.foreground,
    textAlign: 'center',
  },
});
