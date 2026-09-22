'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Colors follow the dataviz skill's method: a fixed categorical order for
 * the combined 3-line Scores chart (never cycled, never reassigned when a
 * series is toggled), and the app's own primary teal for every
 * single-series chart, where the card title already names the series so no
 * legend is needed. Palette slots 1-3 are pre-validated CVD-safe in light
 * mode (dataviz skill's references/palette.md) — this app has no dark mode
 * anywhere yet (no next-themes, no `dark:` classes), so a dark-mode variant
 * is deliberately out of scope for this phase; see docs/phase-6-summary.md.
 */
const SLEEP_COLOR = '#2a78d6';
const READINESS_COLOR = '#eb6834';
const ACTIVITY_COLOR = '#1baf7a';
const METRIC_COLOR = '#0F4C42'; // Tailwind `primary` (tailwind.config.ts)

export interface TrendPointDTO {
  date: string; // ISO yyyy-mm-dd
  sleepScore: number | null;
  readinessScore: number | null;
  activityScore: number | null;
  totalSleepMinutes: number | null;
  restingHeartRate: number | null;
  averageHrv: number | null;
  steps: number | null;
}

const RANGES = [7, 30] as const;
type Range = (typeof RANGES)[number];

function formatDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">{children}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No data for this range yet.
    </div>
  );
}

export function TrendCharts({
  initialRange,
  initialPoints,
}: {
  initialRange: Range;
  initialPoints: TrendPointDTO[];
}) {
  const [range, setRange] = useState<Range>(initialRange);
  const [points, setPoints] = useState<TrendPointDTO[]>(initialPoints);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const hasAnyData = useMemo(
    () =>
      points.some(
        (p) =>
          p.sleepScore !== null ||
          p.readinessScore !== null ||
          p.activityScore !== null ||
          p.totalSleepMinutes !== null ||
          p.restingHeartRate !== null ||
          p.averageHrv !== null ||
          p.steps !== null,
      ),
    [points],
  );

  const chartData = useMemo(
    () => points.map((p) => ({ ...p, label: formatDateLabel(p.date) })),
    [points],
  );

  async function handleRangeChange(next: Range) {
    if (next === range) return;
    setRange(next);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboard/trends?range=${next}`);
      if (!response.ok) {
        throw new Error('request_failed');
      }
      const data: TrendPointDTO[] = await response.json();
      setPoints(data);
    } catch {
      setError('Could not load this range. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex rounded-xl border border-card-border bg-card p-1" role="group" aria-label="Trend range">
          {RANGES.map((r) => (
            <Button
              key={r}
              type="button"
              variant={r === range ? 'primary' : 'ghost'}
              size="sm"
              className={cn('rounded-lg', r === range ? '' : 'text-muted-foreground')}
              aria-pressed={r === range}
              onClick={() => handleRangeChange(r)}
            >
              {r}-day
            </Button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Hide table' : 'Show as table'}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className={cn('space-y-6', loading && 'opacity-60')} aria-busy={loading}>
        <ChartCard title="Scores" description="Sleep, readiness and activity — higher is better, 0-100.">
          {hasAnyData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EC" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={{ stroke: '#E7E9EC' }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sleepScore" name="Sleep" stroke={SLEEP_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="readinessScore" name="Readiness" stroke={READINESS_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="activityScore" name="Activity" stroke={ACTIVITY_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState />
          )}
        </ChartCard>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="HRV" description="Average heart rate variability (ms).">
            {hasAnyData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EC" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={{ stroke: '#E7E9EC' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip />
                  <Line type="monotone" dataKey="averageHrv" stroke={METRIC_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </ChartCard>

          <ChartCard title="Resting heart rate" description="Beats per minute.">
            {hasAnyData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EC" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={{ stroke: '#E7E9EC' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip />
                  <Line type="monotone" dataKey="restingHeartRate" stroke={METRIC_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </ChartCard>

          <ChartCard title="Sleep duration" description="Total sleep, in minutes.">
            {hasAnyData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EC" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={{ stroke: '#E7E9EC' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip />
                  <Line type="monotone" dataKey="totalSleepMinutes" stroke={METRIC_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </ChartCard>

          <ChartCard title="Steps" description="Daily step count.">
            {hasAnyData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EC" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={{ stroke: '#E7E9EC' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip />
                  <Line type="monotone" dataKey="steps" stroke={METRIC_COLOR} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </ChartCard>
        </div>
      </div>

      {showTable && (
        <Card>
          <CardHeader>
            <CardTitle>Data table</CardTitle>
            <CardDescription>The same values shown in the charts above, for accessibility or export.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-card-border text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Sleep</th>
                  <th className="py-2 pr-4 font-medium">Readiness</th>
                  <th className="py-2 pr-4 font-medium">Activity</th>
                  <th className="py-2 pr-4 font-medium">HRV</th>
                  <th className="py-2 pr-4 font-medium">Resting HR</th>
                  <th className="py-2 pr-4 font-medium">Sleep min</th>
                  <th className="py-2 pr-4 font-medium">Steps</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.date} className="border-b border-card-border last:border-0">
                    <td className="py-2 pr-4">{p.date}</td>
                    <td className="py-2 pr-4">{p.sleepScore ?? '—'}</td>
                    <td className="py-2 pr-4">{p.readinessScore ?? '—'}</td>
                    <td className="py-2 pr-4">{p.activityScore ?? '—'}</td>
                    <td className="py-2 pr-4">{p.averageHrv ?? '—'}</td>
                    <td className="py-2 pr-4">{p.restingHeartRate ?? '—'}</td>
                    <td className="py-2 pr-4">{p.totalSleepMinutes ?? '—'}</td>
                    <td className="py-2 pr-4">{p.steps ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
