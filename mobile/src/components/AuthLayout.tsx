import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/src/components/ui/Card';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Shared shell for the signed-out screens (login, register, password
 * reset): brand title, one centered card, scrolls when the keyboard or a
 * long form (register) needs it. Mirrors the web app's `(auth)/layout.tsx`.
 */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingTop: styles.content.padding + insets.top, paddingBottom: styles.content.padding + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Longevity Klub</Text>
        <Card style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.body}>{children}</View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 },
  brand: { fontFamily: fontFamily.display, fontSize: 28, color: colors.foreground, textAlign: 'center' },
  card: { gap: 16, width: '100%', maxWidth: 440, alignSelf: 'center' },
  title: { fontFamily: fontFamily.sansSemibold, fontSize: 18, color: colors.foreground },
  body: { gap: 14 },
});
