import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { getProfileBundle } from '@/modules/profile/profile.service';
import { getConnectionForUserAndProvider } from '@/modules/wearable/services/wearable.service';
import { getTodaySnapshot, getWeeklyWorkoutCount } from '@/modules/dashboard/dashboard.service';
import { getActiveProtocol } from '@/modules/protocols/protocols.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

/** Renders under a target-bearing card's value, e.g. "Target: 85". Never
 * rendered at all when the active protocol doesn't set that target — a
 * user without a followed protocol sees the dashboard exactly as before
 * this feature existed. */
function TargetLine({ target, unit }: { target: number | null | undefined; unit?: string }) {
  if (target === null || target === undefined) return null;
  return (
    <p className="mt-1 text-sm font-medium text-accent">
      Target: {target}
      {unit ? ` ${unit}` : ''}
    </p>
  );
}

function ScoreCard({
  label,
  value,
  unit,
  target,
}: {
  label: string;
  value: number | null;
  unit?: string;
  target?: number | null;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight">
          {value === null ? '—' : value}
          {value !== null && unit ? <span className="ml-1 text-lg font-normal text-muted-foreground">{unit}</span> : null}
        </p>
        {target != null ? (
          <TargetLine target={target} unit={unit} />
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{value === null ? 'No data yet' : ' '}</p>
        )}
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
  const [{ profile }, connection, snapshot, activeProtocol, weeklyWorkoutCount] = await Promise.all([
    getProfileBundle(user.id),
    getConnectionForUserAndProvider(user.id, 'OURA'),
    getTodaySnapshot(user.id),
    getActiveProtocol(user.id),
    getWeeklyWorkoutCount(user.id),
  ]);

  const sleepDuration = formatSleepDuration(snapshot?.totalSleepMinutes ?? null);
  const targetSleepDuration = formatSleepDuration(activeProtocol?.targetSleepMinutes ?? null);

  // `s` is typed `any` because @prisma/client's generated ProtocolSupplement
  // type isn't available in this sandbox — see docs/phase-1-summary.md.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const protocolSupplementItems = (activeProtocol?.supplements ?? []).map((s: any) => (
    <li key={s.id}>
      {s.name}
      {s.dosage ? ` — ${Number(s.dosage)}${s.unit ? ` ${s.unit}` : ''}` : ''}
      {s.frequency ? ` (${s.frequency.replaceAll('_', ' ').toLowerCase()})` : ''}
    </li>
  ));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="relative inline-block font-display text-3xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-2/3 after:rounded-full after:bg-gradient-to-r after:from-primary after:to-accent">
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

      {activeProtocol && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Following: {activeProtocol.name}</CardTitle>
            <CardDescription>
              {activeProtocol.description || 'Today\'s actuals above are compared against this protocol\'s targets.'}
            </CardDescription>
          </CardHeader>
          {activeProtocol.supplements.length > 0 && (
            <CardContent className="pt-0">
              <p className="text-sm font-medium text-muted-foreground">Supplements on this protocol</p>
              <ul className="mt-1 list-inside list-disc text-sm text-foreground">{protocolSupplementItems}</ul>
            </CardContent>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ScoreCard label="Sleep" value={snapshot?.sleepScore ?? null} target={activeProtocol?.targetSleepScore} />
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
            {targetSleepDuration ? (
              <p className="mt-1 text-sm font-medium text-accent">Target: {targetSleepDuration}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">{sleepDuration ? ' ' : 'No data yet'}</p>
            )}
          </CardContent>
        </Card>
        <ScoreCard label="Steps" value={snapshot?.steps ?? null} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ScoreCard
          label="Active calories (today)"
          value={snapshot?.activeCalories ?? null}
          unit="kcal"
          target={activeProtocol?.targetDailyActiveCalories}
        />
        <ScoreCard
          label="Workouts (last 7 days)"
          value={weeklyWorkoutCount}
          target={activeProtocol?.targetWeeklyWorkouts}
        />
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
