import { teamChartModel } from '../teamChart';

describe('teamChartModel', () => {
  it('labels the days, repeats the target and leaves headroom above the larger of target and total', () => {
    const model = teamChartModel({
      targetTotal: 100000,
      points: [
        { date: '2026-10-10', amount: 4000, cumulative: 4000 },
        { date: '2026-10-11', amount: 6000, cumulative: 10000 },
      ],
    });
    expect(model.labels).toEqual(['10 Oct', '11 Oct']);
    expect(model.totals).toEqual([4000, 10000]);
    expect(model.targets).toEqual([100000, 100000]);
    expect(model.yMax).toBe(120000);
  });

  it('grows the axis when the team is above the target', () => {
    const model = teamChartModel({ targetTotal: 100, points: [{ date: '2026-10-10', amount: 200, cumulative: 200 }] });
    expect(model.yMax).toBe(240);
  });

  it('is empty without points', () => {
    const model = teamChartModel({ targetTotal: 100, points: [] });
    expect(model.labels).toEqual([]);
    expect(model.totals).toEqual([]);
    expect(model.yMax).toBe(120);
  });
});
