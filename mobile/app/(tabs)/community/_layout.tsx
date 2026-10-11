import { Stack } from 'expo-router';

import { mainStackScreenOptions } from '@/src/navigation/stackOptions';

/** Community: the groups you belong to (invitations, team challenges) and the creators you follow. */
export default function CommunityStackLayout() {
  return (
    <Stack screenOptions={mainStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Community' }} />
      <Stack.Screen name="browse" options={{ title: 'Creators' }} />
      <Stack.Screen name="creators/[id]" options={{ title: 'Creator' }} />
    </Stack>
  );
}
