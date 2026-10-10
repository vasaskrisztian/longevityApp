import { AdminGroupsList } from '@/components/wellbeing/admin-groups-list';
import { PageTitle } from '@/components/wellbeing/parts';

export default function AdminGroupsPage() {
  return (
    <div className="space-y-6">
      <PageTitle>Corporate wellbeing</PageTitle>
      <AdminGroupsList />
    </div>
  );
}
