import { Redirect } from 'expo-router';

/** Old /trends bookmark → Today > Trends. */
export default function LegacyTrends() {
  return <Redirect href="/?tab=trends" />;
}
