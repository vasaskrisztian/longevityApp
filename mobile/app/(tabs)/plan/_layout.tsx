import { Stack } from 'expo-router';

import { mainStackScreenOptions } from '@/src/navigation/stackOptions';

/** Plan: what you follow and aim for — protocols with their goals, supplements, your own challenges. */
export default function PlanStackLayout() {
  return (
    <Stack screenOptions={mainStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Plan' }} />
      <Stack.Screen name="protocols" options={{ title: 'Protocols and goals' }} />
      <Stack.Screen name="supplements" options={{ title: 'Supplements' }} />
      <Stack.Screen name="goals" options={{ title: 'Goals' }} />
      <Stack.Screen name="challenges" options={{ title: 'My challenges' }} />
    </Stack>
  );
}
