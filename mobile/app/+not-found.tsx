import { Stack, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { useT } from '@/src/i18n';
import { colors, fontFamily } from '@/src/theme/tokens';

/** Unknown route — a branded dead end with one way out (the Expo template screen it replaces was English-only and unstyled). */
export default function NotFoundScreen() {
  const { t } = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('nav.notFound.title') }} />
      <View style={styles.container}>
        <Text style={styles.title}>{t('nav.notFound.heading')}</Text>
        <Text style={styles.body}>{t('nav.notFound.body')}</Text>
        <Button title={t('nav.notFound.goHome')} onPress={() => router.replace('/')} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.background },
  title: { fontFamily: fontFamily.display, fontSize: 24, color: colors.foreground, textAlign: 'center' },
  body: { fontFamily: fontFamily.sans, fontSize: 14, color: colors.muted.foreground, textAlign: 'center', maxWidth: 360, lineHeight: 20 },
});
