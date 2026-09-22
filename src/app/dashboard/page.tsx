import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { getProfileBundle } from '@/modules/profile/profile.service';
import { getConnectionForUserAndProvider } from '@/modules/wearable/services/wearable.service';
import { getTodaySnapshot } from '@/modules/dashboard/dashboard.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function ScoreCard({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight">
          {value === null ? '—' : value}
          {value !== null && unit ? <span className="ml-1 text-lg font-normal text-muted-foreground">{unit}</span> : null}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {value === null ? 'No data yet' : ' '}
        </p>
      </CardContent>
    </Card>
  );
}

function formatSleepDuration(totalMinutes: number | null): string | null {
  if (totalMinutes === null) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export default async function DashboardPage() {
  const user = await requireAuthenticatedUserForPage();
  const [{ profile }, connection, snapshot] = await Promise.all([
    getProfileBundle(user.id),
    getConnectionForUserAndProvider(user.id, 'OURA'),
    getTodaySnapshot(user.id),
  ]);

  const sleepDuration = formatSleepDuration(snapshot?.totalSleepMinutes ?? null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile?.fullName ? `Hi, ${profile.fullName.split(' ')[0]}` : 'Dashboard'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {connection.status === 'CONNECTED'
            ? `Oura: connected${
                connection.lastSyncAt ? ` · last synced ${connection.lastSyncAt.toLocaleString()}` : ''
              }`
            : 'No wearable connected yet.'}
        </p>
      </div>

      {snapshot && !snapshot.isToday && (
        <div className="rounded-xl border border-card-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          No data has synced for today yet — showing the most recent day available (
          {snapshot.date.toLocaleDateString()}).
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ScoreCard label="Sleep" value={snapshot?.sleepScore ?? null} />
        <ScoreCard label="Readiness" value={snapshot?.readinessScore ?? null} />
        <ScoreCard label="Activity" value={snapshot?.activityScore ?? null} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <ScoreCard label="HRV" value={snapshot?.averageHrv ?? null} unit="ms" />
        <ScoreCard label="Resting HR" value={snapshot?.restingHeartRate ?? null} unit="bpm" />
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Sleep duration</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight">{sleepDuration ?? '—'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{sleepDuration ? ' ' : 'No data yet'}</p>
          </CardContent>
        </Card>
        <ScoreCard label="Steps" value={snapshot?.steps ?? null} />
      </div>

      {!snapshot && (
        <Card>
          <CardHeader>
            <CardTitle>No wellness data yet</CardTitle>
            <CardDescription>
              {connection.status === 'CONNECTED'
                ? "Your Oura Ring is connected — the first sync populates this dashboard once it runs."
                : 'Connect your Oura Ring to start seeing Sleep, Readiness and Activity scores here.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/profile/devices" className="text-sm font-medium text-primary hover:underline">
              {connection.status === 'CONNECTED' ? 'Manage your connection →' : 'Connect your Oura Ring →'}
            </a>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        This platform provides wellness information and does not provide medical diagnoses
        or medical advice.
      </p>
    </div>
  );
}
