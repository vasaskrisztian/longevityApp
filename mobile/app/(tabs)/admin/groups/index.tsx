import { Redirect } from 'expo-router';

/** Old /admin/groups link → Admin > Groups. */
export default function LegacyAdminGroups() {
  return <Redirect href="/admin?tab=groups" />;
}
