import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { getTrend } from '@/modules/dashboard/dashboard.service';
import { TrendCharts, type TrendPointDTO } from './trend-charts';

function toDTO(point: Awaited<ReturnType<typeof getTrend>>[number]): TrendPointDTO {
  return {
    date: point.date.toISOString().slice(0, 10),
    sleepScore: point.sleepScore,
    readinessScore: point.readinessScore,
    activityScore: point.activityScore,
    totalSleepMinutes: point.totalSleepMinutes,
    restingHeartRate: point.restingHeartRate,
    averageHrv: point.averageHrv,
    steps: point.steps,
  };
}

export default async function TrendsPage() {
  const user = await requireAuthenticatedUserForPage();
  const initialTrend = await getTrend(user.id, 7);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sleep, readiness and activity scores, HRV, resting heart rate, sleep duration and
          steps over the last 7 or 30 days.
        </p>
      </div>
      <TrendCharts initialRange={7} initialPoints={initialTrend.map(toDTO)} />
    </div>
  );
}
