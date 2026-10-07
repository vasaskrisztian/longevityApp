import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Shell for the signed-out creator teaser pages: brand header with
 * Log in / Sign up shortcuts, a centered content column, and (via
 * <JoinCard>) the call to action that is the whole point of the page.
 */
export function PublicLayout({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingTop: styles.content.padding + insets.top, paddingBottom: styles.content.padding + insets.bottom },
      ]}
    >
      <View style={styles.column}>
        <View style={styles.header}>
          <Pressable onPress={() => router.navigate('/creators')} accessibilityRole="link">
            <Text style={styles.brand}>Longevity Klub</Text>
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push('/login')} accessibilityRole="link">
              <Text style={styles.headerLink}>Log in</Text>
            </Pressable>
          </View>
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

export function JoinCard({ headline, body }: { headline: string; body: string }) {
  return (
    <Card style={styles.join}>
      <Text style={styles.joinTitle}>{headline}</Text>
      <Text style={styles.joinBody}>{body}</Text>
      <Button title="Create a free account" onPress={() => router.push('/register')} />
      <Button title="I already have an account" variant="outline" onPress={() => router.push('/login')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: 20 },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  brand: { fontFamily: fontFamily.display, fontSize: 22, color: colors.foreground },
  headerActions: { flexDirection: 'row', gap: 16 },
  headerLink: { fontFamily: fontFamily.sansSemibold, fontSize: 14, color: colors.primary.default },
  join: { gap: 12 },
  joinTitle: { fontFamily: fontFamily.display, fontSize: 20, color: colors.foreground },
  joinBody: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.muted.foreground, lineHeight: 20 },
});
