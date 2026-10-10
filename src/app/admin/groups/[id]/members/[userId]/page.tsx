import { AdminMemberHealth } from '@/components/wellbeing/admin-member-health';

export default function AdminGroupMemberPage({ params }: { params: { id: string; userId: string } }) {
  return <AdminMemberHealth groupId={params.id} userId={params.userId} />;
}
