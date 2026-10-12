import { useLocalSearchParams } from 'expo-router';

import PersonScreen from '@/src/screens/admin/PersonScreen';

/** Admin > Group > member: the shared person view with the group's consented health data. */
export default function AdminMemberRoute() {
  const { id, userId } = useLocalSearchParams<{ id: string; userId: string }>();
  return <PersonScreen key={`${id}:${userId}`} userId={userId} groupId={id} />;
}
