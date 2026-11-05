import { Stack } from 'expo-router';

import { useT } from '@/src/i18n';
import { mainStackScreenOptions } from '@/src/navigation/stackOptions';

/** Community: the groups you belong to (invitations, team challenges) and the creators you follow. */
export default function CommunityStackLayout() {
  const { t } = useT();
  return (
    <Stack screenOptions={mainStackScreenOptions}>
      <Stack.Screen name="index" options={{ title: t('nav.tab.community') }} />
      <Stack.Screen name="browse" options={{ title: t('nav.community.creators') }} />
      <Stack.Screen name="creators/[id]" options={{ title: t('nav.community.creator') }} />
    </Stack>
  );
}
