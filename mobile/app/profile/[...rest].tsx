import { Redirect, useLocalSearchParams } from 'expo-router';

import { legacyProfileHref } from '@/src/navigation/legacyRoutes';

/** Old /profile/<page> bookmarks (goals, wellbeing, creators/<id>, ...) → their new home. */
export default function LegacyProfileRoute() {
  const { rest } = useLocalSearchParams<{ rest?: string | string[] }>();
  const parts = Array.isArray(rest) ? rest : rest ? [rest] : [];
  return <Redirect href={legacyProfileHref(parts)} />;
}
