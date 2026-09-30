import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { listChallenges } from '@/modules/challenges/challenges.service';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChallengesManager, type ChallengeDTO } from './challenges-manager';

export default async function ChallengesPage() {
  const user = await requireAuthenticatedUserForPage();
  // Unlike Protocols/Goals/Supplements (which query prisma directly here and
  // let the page do the shaping), a Challenge's list view needs its computed
  // ChallengeProgress (status/currentCount/daysRemaining) alongside each row
  // — logic that only lives in challenges.service.ts's computeProgress, so
  // listChallenges is called directly here rather than duplicated. Same
  // precedent as dashboard/page.tsx calling dashboard.service.ts directly.
  const challenges = await listChallenges(user.id);

  const activeCount = challenges.filter((c) => c.progress.status === 'ACTIVE').length;
  const completedCount = challenges.filter((c) => c.progress.status === 'COMPLETED').length;

  // `c` is typed `any` because @prisma/client's generated Challenge type
  // isn't available in this sandbox (prisma generate can't reach
  // binaries.prisma.sh here — see docs/phase-1-summary.md); real deployments
  // get real typing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initial: ChallengeDTO[] = challenges.map((c: any) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    requiredCount: c.requiredCount,
    threshold: c.threshold,
    windowDays: c.windowDays,
    activatedAt: c.activatedAt ? new Date(c.activatedAt).toISOString() : null,
    expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
    progress: c.progress,
  }));

  return (
    <div className="space-y-6">
      <h1 className="relative inline-block font-display text-3xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-2/3 after:rounded-full after:bg-gradient-to-r after:from-primary after:to-accent">
        Challenges
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Your challenges</CardTitle>
          <CardDescription>
            {challenges.length} challenge{challenges.length === 1 ? '' : 's'} on file
            {activeCount > 0 ? ` · ${activeCount} active` : ''}
            {completedCount > 0 ? ` · ${completedCount} completed` : ''}
            {challenges.length === 0 ? ' — set one up and activate it to start tracking.' : ''}
          </CardDescription>
        </CardHeader>
      </Card>
      <ChallengesManager initial={initial} />
    </div>
  );
}
