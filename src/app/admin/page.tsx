import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listUsersForAdmin } from '@/modules/admin/admin.service';
import { AdminUsersTable, type AdminUserListResultDTO } from './admin-users-table';

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  // requireAdmin() already ran in the layout — this page-level query still
  // only ever returns aggregate counts, never another user's raw data.
  const [totalUsers, ouraConnected, authRequired, failedSyncsToday, initialUsers] = await Promise.all([
    prisma.user.count(),
    prisma.wearableConnection.count({ where: { provider: 'OURA', status: 'CONNECTED' } }),
    prisma.wearableConnection.count({ where: { status: 'AUTH_REQUIRED' } }),
    prisma.syncJob.count({
      where: { status: 'FAILED', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    listUsersForAdmin({ q: undefined, ouraStatus: 'ALL', page: 1, pageSize: 20 }),
  ]);

  // The service returns Date objects (fine server-side); the client table
  // takes ISO strings so it can safely pass the same shape back and forth
  // through JSON over the fetch API on every subsequent filter/page change.
  const initial: AdminUserListResultDTO = {
    ...initialUsers,
    users: initialUsers.users.map((user) => ({
      ...user,
      lastSyncAt: user.lastSyncAt ? user.lastSyncAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
    })),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Total users" value={totalUsers} />
        <Kpi label="Oura connected" value={ouraConnected} />
        <Kpi label="Auth required" value={authRequired} />
        <Kpi label="Failed syncs today" value={failedSyncsToday} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminUsersTable initial={initial} />
        </CardContent>
      </Card>
    </div>
  );
}
