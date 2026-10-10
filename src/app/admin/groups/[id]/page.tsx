import Link from 'next/link';
import { AdminGroupDetail } from '@/components/wellbeing/admin-group-detail';

export default function AdminGroupPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-4">
      <Link href="/admin/groups" className="text-sm text-muted-foreground hover:text-foreground">
        ← All groups
      </Link>
      <AdminGroupDetail groupId={params.id} />
    </div>
  );
}
