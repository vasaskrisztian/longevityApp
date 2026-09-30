import { requireAuthenticatedUserForPage } from '@/lib/auth/page-guards';
import { getTrend, toTrendPointDTO } from '@/modules/dashboard/dashboard.service';
import { TrendCharts } from './trend-charts';

export default async function TrendsPage() {
  const user = await requireAuthenticatedUserForPage();
  const initialTrend = await getTrend(user.id, 7);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="relative inline-block font-display text-3xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-2/3 after:rounded-full after:bg-gradient-to-r after:from-primary after:to-accent">Trends</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sleep, readiness and activity scores, HRV, resting heart rate, sleep duration and
          steps over the last 7 or 30 days.
        </p>
      </div>
      <TrendCharts initialRange={7} initialPoints={initialTrend.map(toTrendPointDTO)} />
    </div>
  );
}
