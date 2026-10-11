import { Stack } from 'expo-router';

import { mainStackScreenOptions } from '@/src/navigation/stackOptions';

/** Me: about me (personal, exercise, nutrition), devices and data, account. */
export default function MeStackLayout() {
  return (
    <Stack screenOptions={mainStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Me' }} />
      <Stack.Screen name="about" options={{ title: 'About me' }} />
      <Stack.Screen name="devices" options={{ title: 'Devices' }} />
      <Stack.Screen name="account" options={{ title: 'Account' }} />
    </Stack>
  );
}
