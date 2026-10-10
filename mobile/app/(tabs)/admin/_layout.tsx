import { Stack } from 'expo-router';

import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Phase 22 — nested stack under the Admin tab, same pattern as the Profile
 * tab's own stack (app/(tabs)/profile/_layout.tsx): a drill-down list ->
 * detail navigation needs the native back-button header the tab bar itself
 * doesn't draw.
 */
export default function AdminStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card.default },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fontFamily.sansSemibold },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
      <Stack.Screen name="users/[id]" options={{ title: 'User detail' }} />
      <Stack.Screen name="groups/index" options={{ title: 'Wellbeing groups' }} />
      <Stack.Screen name="groups/[id]/index" options={{ title: 'Group' }} />
      <Stack.Screen name="groups/[id]/members/[userId]" options={{ title: 'Member health' }} />
      <Stack.Screen name="groups/[id]/challenges/[challengeId]" options={{ title: 'Challenge' }} />
    </Stack>
  );
}
