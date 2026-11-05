import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useSession } from '@/src/auth/useSession';
import { Button } from '@/src/components/ui/Button';
import { HubList } from '@/src/components/ui/HubRow';
import { useT } from '@/src/i18n';
import { colors, fontFamily, screenBackground } from '@/src/theme/tokens';
import { ScreenBackdrop } from '@/src/components/AppBackdrop';

export default function MeScreen() {
  const { t } = useT();
  const { user, logout } = useSession();
  return (
    <View style={styles.container}>
      <ScreenBackdrop />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {user ? <Text style={styles.email}>{user.email}</Text> : null}
      <HubList
        items={[
          { label: t('nav.me.about'), description: t('nav.me.aboutDescription'), icon: 'person-outline', onPress: () => router.push('/me/about') },
          { label: t('nav.me.devicesAndData'), description: t('nav.me.devicesDescription'), icon: 'watch-outline', onPress: () => router.push('/me/devices') },
          { label: t('nav.me.account'), description: t('nav.me.accountDescription'), icon: 'settings-outline', onPress: () => router.push('/me/account') },
        ]}
      />
      <Button title={t('common.logOut')} variant="destructive" onPress={() => logout()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: screenBackground },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 16 },
  email: { fontFamily: fontFamily.sansMedium, fontSize: 15, color: colors.muted.foreground },
});
