import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuthenticatedUser, UnauthenticatedError } from '@/lib/auth/authorization';
import {
  getCreatorPublicProfile,
  getCreatorTeaser,
  type PublicProtocol,
} from '@/modules/creators/creators.service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FollowButton } from './follow-button';

// Always-fresh data (follower count, published content) — never
// statically cached. See /app/creators/page.tsx's comment.
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

function MetricCell({ value, unit }: { value: number | string | null; unit?: string }) {
  return <td className="px-3 py-1.5 text-right">{value == null ? '—' : `${value}${unit ?? ''}`}</td>;
}

async function isSignedIn(): Promise<boolean> {
  try {
    await requireAuthenticatedUser();
    return true;
  } catch (error) {
    if (error instanceof UnauthenticatedError) return false;
    throw error;
  }
}

/**
 * What a visitor without an account sees: only the basic facts (name, join
 * date, counts) from getCreatorTeaser — never protocols, challenges or
 * health data — plus the call to register or log in.
 */
async function CreatorTeaserView({ id }: { id: string }) {
  const teaser = await getCreatorTeaser(id);
  if (!teaser) {
    notFound();
  }
  const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
          {teaser.fullName ?? 'Creator'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Creator since {teaser.memberSince.toLocaleDateString()}
        </p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 text-sm sm:grid-cols-4">
          <div>{plural(teaser.followerCount, 'follower')}</div>
          <div>{plural(teaser.publicProtocolCount, 'protocol')}</div>
          <div>{plural(teaser.publicChallengeCount, 'challenge')}</div>
          <div>{plural(teaser.trackedDays, 'day')} tracked</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unlock the full profile</CardTitle>
          <CardDescription>
            Create a free account to read this creator’s protocols, follow their challenges and see their recent
            results.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Create a free account
          </Link>
          <Link href="/login" className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium">
            Log in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function CreatorPublicProfilePage({ params }: PageProps) {
  // Detailed content is for registered users only; visitors get the teaser.
  if (!(await isSignedIn())) {
    return <CreatorTeaserView id={params.id} />;
  }

  const profile = await getCreatorPublicProfile(params.id);
  if (!profile) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-primary">
            {profile.fullName ?? 'Creator'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.followerCount} follower{profile.followerCount === 1 ? '' : 's'} · creator since{' '}
            {profile.memberSince.toLocaleDateString()}
          </p>
        </div>
        <FollowButton creatorId={profile.id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Protocols</CardTitle>
          <CardDescription>Target plans this creator has made public.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.protocols.length === 0 ? (
            <p className="text-sm text-muted-foreground">No public protocols yet.</p>
          ) : (
            profile.protocols.map((protocol) => (
              <div key={protocol.id} className="rounded-xl border border-card-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{protocol.name}</h3>
                  {protocol.isActive && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                      Active
                    </span>
                  )}
                </div>
                {protocol.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{protocol.description}</p>
                )}
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Target sleep score</dt>
                    <dd>{protocol.targetSleepScore ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Target sleep</dt>
                    <dd>{protocol.targetSleepMinutes ? `${protocol.targetSleepMinutes} min` : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Weekly workouts</dt>
                    <dd>{protocol.targetWeeklyWorkouts ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Active calories</dt>
                    <dd>{protocol.targetDailyActiveCalories ?? '—'}</dd>
                  </div>
                </dl>
                {protocol.supplements.length > 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Supplements:{' '}
                    {protocol.supplements.map((s: PublicProtocol['supplements'][number]) => s.name).join(', ')}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Challenges</CardTitle>
          <CardDescription>Time-boxed commitments this creator has made public.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile.challenges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No public challenges yet.</p>
          ) : (
            profile.challenges.map((challenge) => (
              <div
                key={challenge.id}
                className="flex items-center justify-between rounded-xl border border-card-border p-4"
              >
                <div>
                  <p className="font-medium">{challenge.name ?? challenge.type}</p>
                  <p className="text-sm text-muted-foreground">
                    {challenge.progress.currentCount}/{challenge.progress.requiredCount} ·{' '}
                    {challenge.progress.daysRemaining != null
                      ? `${challenge.progress.daysRemaining} day(s) left`
                      : 'Resolved'}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                  {challenge.progress.status}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent health data</CardTitle>
          <CardDescription>Last 90 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {profile.recentMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent data to show.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-xl border border-card-border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Date</th>
                    <th className="px-3 py-1.5 text-right font-medium">Sleep score</th>
                    <th className="px-3 py-1.5 text-right font-medium">Steps</th>
                    <th className="px-3 py-1.5 text-right font-medium">Resting HR</th>
                    <th className="px-3 py-1.5 text-right font-medium">HRV</th>
                    <th className="px-3 py-1.5 text-right font-medium">Active cal.</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.recentMetrics.map((m) => (
                    <tr key={m.date.toISOString()} className="border-t border-card-border">
                      <td className="px-3 py-1.5">{m.date.toLocaleDateString()}</td>
                      <MetricCell value={m.sleepScore} />
                      <MetricCell value={m.steps} />
                      <MetricCell value={m.restingHeartRate} unit=" bpm" />
                      <MetricCell value={m.averageHrv ? Number(m.averageHrv) : null} unit=" ms" />
                      <MetricCell value={m.activeCalories} />
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
