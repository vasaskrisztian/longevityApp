import { Stack } from 'expo-router';

import { mainStackScreenOptions } from '@/src/navigation/stackOptions';

/**
 * Phase 22 — nested stack under the Admin tab, same pattern as the Plan,
 * Community and Me stacks (navigation/stackOptions.tsx): a drill-down list ->
 * detail navigation needs the native back-button header the tab bar itself
 * doesn't draw.
 */
export default function AdminStackLayout() {
  return (
    <Stack screenOptions={mainStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
      <Stack.Screen name="users/[id]" options={{ title: 'Person' }} />
      <Stack.Screen name="groups/index" options={{ headerShown: false }} />
      <Stack.Screen name="groups/[id]/index" options={{ title: 'Group' }} />
      <Stack.Screen name="groups/[id]/members/[userId]" options={{ title: 'Person' }} />
      <Stack.Screen name="groups/[id]/challenges/[challengeId]" options={{ title: 'Challenge' }} />
    </Stack>
  );
}
