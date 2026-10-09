import {
  SleepValue,
  aggregateSleep,
  buildDailySamples,
  localDayKey,
  type SleepSampleLike,
} from '../aggregate';

const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00`); // local time
const sample = (value: number, start: Date, end: Date): SleepSampleLike => ({ value, startDate: start, endDate: end });

describe('localDayKey', () => {
  it('uses the local calendar day', () => {
    expect(localDayKey(new Date(2026, 9, 8, 23, 59))).toBe('2026-10-08');
    expect(localDayKey(new Date(2026, 0, 2, 0, 0))).toBe('2026-01-02');
  });
});

describe('aggregateSleep', () => {
  it('attributes a night that crosses midnight to the day it ends, with stage totals', () => {
    const night = aggregateSleep([
      sample(SleepValue.inBed, at('2026-10-07', '22:30'), at('2026-10-08', '06:30')),
      sample(SleepValue.asleepCore, at('2026-10-07', '23:00'), at('2026-10-08', '01:00')), // 120
      sample(SleepValue.asleepDeep, at('2026-10-08', '01:00'), at('2026-10-08', '02:00')), // 60
      sample(SleepValue.asleepREM, at('2026-10-08', '02:00'), at('2026-10-08', '03:00')), // 60
      sample(SleepValue.awake, at('2026-10-08', '03:00'), at('2026-10-08', '03:30')), // 30
      sample(SleepValue.asleepCore, at('2026-10-08', '03:30'), at('2026-10-08', '06:00')), // 150
    ]);
    expect([...night.keys()]).toEqual(['2026-10-08']);
    const n = night.get('2026-10-08')!;
    expect(n.totalSleepMinutes).toBe(390);
    expect(n.deepSleepMinutes).toBe(60);
    expect(n.remSleepMinutes).toBe(60);
    expect(n.lightSleepMinutes).toBe(270);
    expect(n.awakeMinutes).toBe(30);
    // 390 asleep / 480 min in bed
    expect(n.sleepEfficiencyPct).toBe(81.3);
    expect(n.bedtimeStart).toBe(at('2026-10-07', '22:30').toISOString());
    expect(n.bedtimeEnd).toBe(at('2026-10-08', '06:30').toISOString());
  });

  it('never counts the same minute twice when two sources overlap (deepest stage wins)', () => {
    const result = aggregateSleep([
      sample(SleepValue.asleepUnspecified, at('2026-10-08', '00:00'), at('2026-10-08', '06:00')), // phone: 360
      sample(SleepValue.asleepDeep, at('2026-10-08', '01:00'), at('2026-10-08', '02:00')), // watch: 60 overlaps
    ]).get('2026-10-08')!;
    expect(result.totalSleepMinutes).toBe(360);
    expect(result.deepSleepMinutes).toBe(60);
  });

  it('keeps a daytime nap separate from the night but on its own day', () => {
    const result = aggregateSleep([
      sample(SleepValue.asleepCore, at('2026-10-07', '23:00'), at('2026-10-08', '06:00')),
      sample(SleepValue.asleepCore, at('2026-10-08', '14:00'), at('2026-10-08', '14:30')),
    ]);
    // Both end on 2026-10-08 -> summed into that day.
    expect(result.get('2026-10-08')!.totalSleepMinutes).toBe(450);
  });

  it('ignores in-bed-only sessions and unknown values', () => {
    expect(
      aggregateSleep([
        sample(SleepValue.inBed, at('2026-10-07', '22:00'), at('2026-10-08', '06:00')),
        sample(99, at('2026-10-08', '07:00'), at('2026-10-08', '08:00')),
      ]).size,
    ).toBe(0);
  });

  it('splits sessions separated by more than two hours into separate days', () => {
    const result = aggregateSleep([
      sample(SleepValue.asleepCore, at('2026-10-06', '23:00'), at('2026-10-07', '06:00')),
      sample(SleepValue.asleepCore, at('2026-10-07', '23:00'), at('2026-10-08', '06:00')),
    ]);
    expect([...result.keys()].sort()).toEqual(['2026-10-07', '2026-10-08']);
    expect(result.get('2026-10-07')!.totalSleepMinutes).toBe(420);
  });

  it('computes efficiency from asleep+awake when there are no in-bed samples', () => {
    const result = aggregateSleep([
      sample(SleepValue.asleepCore, at('2026-10-08', '00:00'), at('2026-10-08', '04:00')), // 240
      sample(SleepValue.awake, at('2026-10-08', '04:00'), at('2026-10-08', '04:30')), // 30
    ]).get('2026-10-08')!;
    expect(result.sleepEfficiencyPct).toBe(88.9);
  });
});

describe('buildDailySamples', () => {
  const map = (entries: Record<string, number>) => new Map(Object.entries(entries));

  it('merges metrics per day, rounds to schema types and derives total calories', () => {
    const out = buildDailySamples(
      {
        steps: map({ '2026-10-07': 8123.4, '2026-10-08': 500 }),
        activeCalories: map({ '2026-10-07': 410.6 }),
        basalCalories: map({ '2026-10-07': 1700.2 }),
        restingHeartRate: map({ '2026-10-07': 55.6 }),
        hrv: map({ '2026-10-07': 61.234 }),
      },
      '2026-10-01',
      '2026-10-08',
    );
    expect(out).toEqual([
      {
        date: '2026-10-07',
        steps: 8123,
        activeCalories: 411,
        totalCalories: 2111,
        restingHeartRate: 56,
        averageHrv: 61.2,
      },
      { date: '2026-10-08', steps: 500 },
    ]);
  });

  it('drops days outside the window, days with no data, and out-of-range values', () => {
    const out = buildDailySamples(
      {
        steps: map({ '2026-09-01': 100, '2026-10-02': 0 }),
        restingHeartRate: map({ '2026-10-02': 5 }), // below schema minimum (20) -> dropped
        hrv: map({ '2026-10-03': NaN }),
      },
      '2026-10-01',
      '2026-10-08',
    );
    expect(out).toEqual([{ date: '2026-10-02', steps: 0 }]);
  });

  it('includes sleep fields and creates a day for a sleep-only date', () => {
    const sleep = aggregateSleep([
      sample(SleepValue.asleepCore, at('2026-10-07', '23:00'), at('2026-10-08', '06:00')),
    ]);
    const out = buildDailySamples({ sleep }, '2026-10-01', '2026-10-08');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ date: '2026-10-08', totalSleepMinutes: 420, lightSleepMinutes: 420 });
    expect(out[0]).not.toHaveProperty('deepSleepMinutes');
  });
});
