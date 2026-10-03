import { Stack } from 'expo-router';

import { colors, fontFamily } from '@/src/theme/tokens';

/**
 * Nested stack under the Profile tab — Lifestyle/Nutrition/Supplements/
 * Goals live here rather than as top-level tabs, same as the web app's
 * sidebar groups them under Profile (see phase-15-mobile-migration-plan.md
 * phase 15's navigation note). Unlike the tab bar (headerShown: false,
 * since Tabs draws its own chrome), this stack keeps its default header
 * with a back button — exactly the native affordance a drill-down list of
 * sub-sections needs.
 */
export default function ProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card.default },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fontFamily.sansSemibold },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
      <Stack.Screen name="goals" options={{ title: 'Goals' }} />
      <Stack.Screen name="supplements" options={{ title: 'Supplements' }} />
      <Stack.Screen name="nutrition" options={{ title: 'Nutrition' }} />
      <Stack.Screen name="lifestyle" options={{ title: 'Lifestyle' }} />
    </Stack>
  );
}
