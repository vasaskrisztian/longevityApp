import { useLocalSearchParams } from 'expo-router';

import PersonScreen from '@/src/screens/admin/PersonScreen';

/** Admin > Users > person: the shared person view without a group context. */
export default function AdminUserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PersonScreen key={id} userId={id} />;
}
