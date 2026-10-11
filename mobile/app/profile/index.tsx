import { Redirect } from 'expo-router';

import { legacyProfileHref } from '@/src/navigation/legacyRoutes';

/** Old /profile bookmark → Me. */
export default function LegacyProfileIndex() {
  return <Redirect href={legacyProfileHref([])} />;
}
