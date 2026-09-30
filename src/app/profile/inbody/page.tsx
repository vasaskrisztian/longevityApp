import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { listInBodyMeasurements } from '@/modules/inbody/inbody.service';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InBodyManager, type InBodyMeasurementDTO } from './inbody-manager';

export default async function InBodyPage() {
  const user = await requireAuthenticatedUserForPage();
  const measurements = await listInBodyMeasurements(user.id);

  const initial: InBodyMeasurementDTO[] = measurements.map((m) => ({
    id: m.id,
    measuredAt: m.measuredAt.toISOString(),
    weightKg: m.weightKg,
    bodyFatPercentage: m.bodyFatPercentage,
    skeletalMuscleMassKg: m.skeletalMuscleMassKg,
    fatFreeMassKg: m.fatFreeMassKg,
    bmi: m.bmi,
    inBodyScore: m.inBodyScore,
    visceralFatLevel: m.visceralFatLevel,
    basalMetabolicRateKcal: m.basalMetabolicRateKcal,
    totalBodyWaterL: m.totalBodyWaterL,
    ecwRatio: m.ecwRatio,
    rawOcrText: m.rawOcrText,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">InBody</h1>
      <Card>
        <CardHeader>
          <CardTitle>Body composition scans</CardTitle>
          <CardDescription>
            {measurements.length === 0
              ? 'Upload a photo or scan of an InBody report to get started.'
              : `${measurements.length} scan${measurements.length === 1 ? '' : 's'} on file.`}
          </CardDescription>
        </CardHeader>
      </Card>
      <InBodyManager initial={initial} />
    </div>
  );
}
