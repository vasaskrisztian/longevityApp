import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/authorization';
import { getUserDetailForAdmin, recordAdminViewUser } from '@/modules/admin/admin.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { TriggerSyncButton } from './trigger-sync-button';

const CONNECTION_STATUS_LABEL: Record<string, string> = {
  CONNECTED: 'Connected',
  DISCONNECTED: 'Not connected',
  AUTH_REQUIRED: 'Reconnect required',
  ERROR: 'Connection error',
};

const CONNECTION_STATUS_BADGE_CLASS: Record<string, string> = {
  CONNECTED: 'bg-emerald-100 text-emerald-800',
  DISCONNECTED: 'bg-muted text-muted-foreground',
  AUTH_REQUIRED: 'bg-amber-100 text-amber-800',
  ERROR: 'bg-red-100 text-red-800',
};

const SYNC_JOB_STATUS_BADGE_CLASS: Record<string, string> = {
  SUCCESS: 'bg-emerald-100 text-emerald-800',
  PARTIAL: 'bg-amber-100 text-amber-800',
  FAILED: 'bg-red-100 text-red-800',
  RUNNING: 'bg-sky-100 text-sky-800',
  PENDING: 'bg-muted text-muted-foreground',
};

function MetricStat({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value == null ? '—' : `${value}${unit ?? ''}`}</dd>
    </div>
  );
}

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  // requireAdmin() (not requireAuthenticatedUserForPage) — this is the exact
  // endpoint the IDOR/BOLA test in ARCHITECTURE.md §10.6 targets. The admin
  // layout already gated the route, but this component re-checks and, on
  // success, writes the ADMIN_VIEW_USER audit row per spec item 44/§8.2.
  const admin = await requireAdmin();

  const detail = await getUserDetailForAdmin(params.id);

  if (!detail) {
    notFound();
  }

  await recordAdminViewUser(admin.id, detail.user.id);

  const { user, connection, todaySnapshot, recentSyncJobs } = detail;

  return (
    <div className="space-y-6">
      <Alert>
        <span className="font-semibold">ADMIN VIEW</span> — Viewing user: {user.fullName ?? user.email}
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <dl className="grid grid-cols-2 gap-2">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.email}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd>{user.role}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{user.status}</dd>
            <dt className="text-muted-foreground">Email verified</dt>
            <dd>{user.emailVerifiedAt ? 'Yes' : 'No'}</dd>
            <dt className="text-muted-foreground">Last login</dt>
            <dd>{user.lastLoginAt ? user.lastLoginAt.toLocaleString() : '—'}</dd>
            <dt className="text-muted-foreground">Joined</dt>
            <dd>{user.createdAt.toLocaleDateString()}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Oura connection</CardTitle>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONNECTION_STATUS_BADGE_CLASS[connection.status]}`}
            >
              {CONNECTION_STATUS_LABEL[connection.status]}
            </span>
          </div>
          <CardDescription>
            {connection.lastSyncAt
              ? `Last sync attempt: ${connection.lastSyncAt.toLocaleString()}${
                  connection.lastSyncStatus ? ` (${connection.lastSyncStatus})` : ''
                }`
              : 'No sync has run yet for this connection.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* §8.3: admins never see EncryptedCredential — connection is a
              ConnectionSummary, the same status-only shape the user's own
              devices page renders. */}
          {connection.status === 'CONNECTED' ? (
            <TriggerSyncButton userId={user.id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              A sync can only be triggered once this user has a connected Oura account.
            </p>
          )}

          {todaySnapshot ? (
            <div>
              <p className="mb-2 text-sm font-medium">
                {todaySnapshot.isToday ? "Today's snapshot" : 'Most recent snapshot'}
                {!todaySnapshot.isToday && ` (${todaySnapshot.date.toLocaleDateString()})`}
              </p>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <MetricStat label="Sleep score" value={todaySnapshot.sleepScore} />
                <MetricStat label="Readiness score" value={todaySnapshot.readinessScore} />
                <MetricStat label="Activity score" value={todaySnapshot.activityScore} />
                <MetricStat label="Sleep duration" value={todaySnapshot.totalSleepMinutes} unit=" min" />
                <MetricStat label="Resting HR" value={todaySnapshot.restingHeartRate} unit=" bpm" />
                <MetricStat label="Average HRV" value={todaySnapshot.averageHrv} unit=" ms" />
                <MetricStat label="Steps" value={todaySnapshot.steps} />
              </dl>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No health metrics recorded for this user yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sync jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSyncJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sync jobs recorded for this user yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-card-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-card-border bg-muted text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Started</th>
                    <th className="px-4 py-2 font-medium">Finished</th>
                    <th className="px-4 py-2 font-medium">Records (fetched/created/updated)</th>
                    <th className="px-4 py-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSyncJobs.map((job) => (
                    <tr key={job.id} className="border-b border-card-border last:border-0">
                      <td className="px-4 py-2">{job.type}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            SYNC_JOB_STATUS_BADGE_CLASS[job.status] ?? 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">{job.startedAt ? job.startedAt.toLocaleString() : '—'}</td>
                      <td className="px-4 py-2">{job.finishedAt ? job.finishedAt.toLocaleString() : '—'}</td>
                      <td className="px-4 py-2">
                        {job.recordsFetched} / {job.recordsCreated} / {job.recordsUpdated}
                      </td>
                      <td className="px-4 py-2 text-danger">
                        {job.errorCode ? `${job.errorCode}${job.errorMessage ? `: ${job.errorMessage}` : ''}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
