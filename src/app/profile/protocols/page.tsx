import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { prisma } from '@/lib/db/prisma';
import { canPublishPublicly } from '@/modules/creators/creators.service';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ProtocolsManager, type ProtocolDTO } from './protocols-manager';

export default async function ProtocolsPage() {
  const user = await requireAuthenticatedUserForPage();
  // No requireOwnResourceOrAdmin needed here — userId is the caller's own
  // id, never a client-supplied param. The CRUD API routes (/api/
  // protocols/[id]) accept an arbitrary id and call requireOwnResourceOrAdmin.
  const [protocols, canPublish] = await Promise.all([
    prisma.protocol.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { supplements: true },
    }),
    // Phase 13: only a consenting CREATOR ever sees the Publish control —
    // see creators.service.ts's doc comment.
    canPublishPublicly(user.id),
  ]);

  // `p`/`s` are typed `any` because @prisma/client's generated types aren't
  // available in this sandbox (prisma generate can't reach binaries.prisma.sh
  // here — see docs/phase-1-summary.md); real deployments get real typing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initial: ProtocolDTO[] = protocols.map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isActive: p.isActive,
    targetSleepScore: p.targetSleepScore,
    targetSleepMinutes: p.targetSleepMinutes,
    targetWeeklyWorkouts: p.targetWeeklyWorkouts,
    targetDailyActiveCalories: p.targetDailyActiveCalories,
    visibility: p.visibility,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supplements: p.supplements.map((s: any) => ({
      name: s.name,
      dosage: s.dosage === null ? null : Number(s.dosage),
      unit: s.unit,
      frequency: s.frequency,
      timing: s.timing,
    })),
  }));

  return (
    <div className="space-y-6">
      <h1 className="relative inline-block font-display text-3xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-2/3 after:rounded-full after:bg-gradient-to-r after:from-primary after:to-accent">
        Protocols
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Your protocols</CardTitle>
          <CardDescription>
            {protocols.length} protocol{protocols.length === 1 ? '' : 's'} on file
            {protocols.some((p: { isActive: boolean }) => p.isActive)
              ? ' · one is active and shown on your dashboard.'
              : ' · none active yet — set one as active to see its targets on your dashboard.'}
          </CardDescription>
        </CardHeader>
      </Card>
      <ProtocolsManager initial={initial} canPublish={canPublish} />
    </div>
  );
}
