import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { prisma } from '@/lib/db/prisma';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GoalsManager, type GoalDTO } from './goals-manager';

export default async function GoalsPage() {
  const user = await requireAuthenticatedUserForPage();
  const goals = await prisma.goal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  // `g` is typed `any` because @prisma/client's generated Goal type isn't
  // available in this sandbox (prisma generate can't reach binaries.prisma.sh
  // here — see docs/phase-1-summary.md); real deployments get real typing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initial: GoalDTO[] = goals.map((g: any) => ({
    id: g.id,
    type: g.type,
    name: g.name,
    description: g.description,
    targetValue: g.targetValue === null ? null : Number(g.targetValue),
    targetUnit: g.targetUnit,
    targetDate: g.targetDate ? new Date(g.targetDate).toISOString().slice(0, 10) : null,
    status: g.status,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your goals</CardTitle>
          <CardDescription>{goals.length} goal{goals.length === 1 ? '' : 's'} on file.</CardDescription>
        </CardHeader>
      </Card>
      <GoalsManager initial={initial} />
    </div>
  );
}
