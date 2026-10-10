import type { CollectiveSeries } from '@/src/api/groups';
import { chartDayLabel, niceAxisMax } from './format';

export interface TeamChartModel {
  labels: string[];
  /** Running team total per day. */
  totals: number[];
  /** The shared target, repeated for every day (drawn as a dashed line). */
  targets: number[];
  /** Top of the y axis: a round number a little above the larger of target and total, so the target line is never on the frame and the gridlines read cleanly. */
  yMax: number;
}

/** Everything the team chart draws, from the API series. Empty `points` give an empty model (nothing to draw yet). */
export function teamChartModel(series: CollectiveSeries): TeamChartModel {
  const totals = series.points.map((point) => point.cumulative);
  const best = Math.max(series.targetTotal, ...totals);
  return {
    labels: series.points.map((point) => chartDayLabel(point.date)),
    totals,
    targets: series.points.map(() => series.targetTotal),
    yMax: niceAxisMax(best * 1.05),
  };
}
