import { Stack } from 'expo-router';

import { useT } from '@/src/i18n';
import { mainStackScreenOptions } from '@/src/navigation/stackOptions';

/** Me: about me (personal, exercise, nutrition), devices and data, account. */
export default function MeStackLayout() {
  const { t } = useT();
  return (
    <Stack screenOptions={mainStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: t('nav.tab.me') }} />
      <Stack.Screen name="about" options={{ title: t('nav.me.about') }} />
      <Stack.Screen name="devices" options={{ title: t('nav.me.devices') }} />
      <Stack.Screen name="account" options={{ title: t('nav.me.account') }} />
    </Stack>
  );
}
