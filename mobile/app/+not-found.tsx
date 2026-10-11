import { Stack, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { colors, fontFamily } from '@/src/theme/tokens';

/** Unknown route — a branded dead end with one way out (the Expo template screen it replaces was English-only and unstyled). */
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This page doesn&apos;t exist</Text>
        <Text style={styles.body}>The link may be old or mistyped. Your data is safe — head back to the start.</Text>
        <Button title="Go to Dashboard" onPress={() => router.replace('/')} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.background },
  title: { fontFamily: fontFamily.display, fontSize: 24, color: colors.foreground, textAlign: 'center' },
  body: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.muted.foreground, textAlign: 'center', maxWidth: 360, lineHeight: 20 },
});
