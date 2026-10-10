import { NotificationsInbox } from '@/components/wellbeing/notifications-inbox';
import { PageTitle } from '@/components/wellbeing/parts';

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageTitle>Notifications</PageTitle>
      <NotificationsInbox />
    </div>
  );
}
