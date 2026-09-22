import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { prisma } from '@/lib/db/prisma';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SupplementsManager, type SupplementDTO } from './supplements-manager';

export default async function SupplementsPage() {
  const user = await requireAuthenticatedUserForPage();
  // No requireOwnResourceOrAdmin needed here — userId is the caller's own
  // id, never a client-supplied param. The CRUD API routes (/api/
  // supplements/[id]) accept an arbitrary id and call requireOwnResourceOrAdmin.
  const supplements = await prisma.supplement.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  // `s` is typed `any` because @prisma/client's generated Supplement type
  // isn't available in this sandbox — see docs/phase-1-summary.md.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initial: SupplementDTO[] = supplements.map((s: any) => ({
    id: s.id,
    name: s.name,
    dosage: Number(s.dosage),
    unit: s.unit,
    frequency: s.frequency,
    timing: s.timing,
    notes: s.notes,
    active: s.active,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Supplements</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your supplements</CardTitle>
          <CardDescription>
            {supplements.length} supplement{supplements.length === 1 ? '' : 's'} on file.
          </CardDescription>
        </CardHeader>
      </Card>
      <SupplementsManager initial={initial} />
    </div>
  );
}
