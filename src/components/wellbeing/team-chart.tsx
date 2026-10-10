'use client';

import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CollectiveSeries, GroupChallengeType } from '@/lib/wellbeing/groups-api';
import { chartDayLabel, collectiveAmountLabel, compactAmount, formatAmount, niceAxisMax } from '@/lib/wellbeing/format';

/** Brand forest green (Tailwind `primary`) for the single series; the target line stays neutral. Same chart styling as the Trends page. */
const SERIES_COLOR = '#2F4A38';
const TARGET_COLOR = '#5B6670';

/**
 * The team's running total per day against the shared target. One series, so
 * the title names it instead of a legend; the target is a labelled reference
 * line; "Show as table" gives the same numbers as text.
 */
export function TeamChart({ type, series }: { type: GroupChallengeType; series: CollectiveSeries }) {
  const [showTable, setShowTable] = useState(false);
  const { points, targetTotal } = series;
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">The chart appears once the challenge has started.</p>;
  }

  const data = points.map((point) => ({ ...point, label: chartDayLabel(point.date) }));
  const best = Math.max(targetTotal, ...points.map((point) => point.cumulative));
  const top = niceAxisMax(best * 1.05);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Team total per day</p>
        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Hide table' : 'Show as table'}
        </button>
      </div>
      <div className="h-48 w-full" role="img" aria-label={`Running team total of ${collectiveAmountLabel(type, points[points.length - 1]!.cumulative)} against the target of ${collectiveAmountLabel(type, targetTotal)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 20, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9EC" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5B6670' }} axisLine={{ stroke: '#E7E9EC' }} tickLine={false} minTickGap={24} />
            <YAxis
              domain={[0, top]}
              ticks={[0, top / 4, top / 2, (top * 3) / 4, top]}
              tick={{ fontSize: 12, fill: '#5B6670' }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={compactAmount}
            />
            <ReferenceLine
              y={targetTotal}
              stroke={TARGET_COLOR}
              strokeDasharray="4 4"
              label={{ value: `Target ${formatAmount(targetTotal)}`, position: 'insideTopLeft', fontSize: 12, fill: '#5B6670' }}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatAmount(value), name === 'cumulative' ? 'Team total' : 'That day']}
              labelFormatter={(label: string) => label}
            />
            <Line type="monotone" dataKey="cumulative" name="cumulative" stroke={SERIES_COLOR} strokeWidth={2} dot={{ r: points.length > 31 ? 0 : 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {showTable && (
        <div className="max-h-56 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-card-border text-muted-foreground">
                <th className="py-1.5 pr-4 font-medium">Day</th>
                <th className="py-1.5 pr-4 font-medium">That day</th>
                <th className="py-1.5 pr-4 font-medium">Team total</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-b border-card-border last:border-0">
                  <td className="py-1.5 pr-4">{point.date}</td>
                  <td className="py-1.5 pr-4">{formatAmount(point.amount)}</td>
                  <td className="py-1.5 pr-4">{formatAmount(point.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
