import { Stack } from 'expo-router';

import { useT } from '@/src/i18n';
import { mainStackScreenOptions } from '@/src/navigation/stackOptions';

/** Plan: what you follow and aim for — protocols with their goals, supplements, your own challenges. */
export default function PlanStackLayout() {
  const { t } = useT();
  return (
    <Stack screenOptions={mainStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: t('nav.tab.plan') }} />
      <Stack.Screen name="protocols" options={{ title: t('nav.plan.protocols') }} />
      <Stack.Screen name="supplements" options={{ title: t('nav.plan.supplements') }} />
      <Stack.Screen name="goals" options={{ title: t('nav.plan.goals') }} />
      <Stack.Screen name="challenges" options={{ title: t('nav.plan.challenges') }} />
    </Stack>
  );
}
