import { SleepValue, aggregateSleep, buildDailySamples, localDayKey } from '../aggregate';
import {
  HcSleepStage,
  averageByLocalDay,
  dayValueMapFromGroups,
  sleepSessionsToSamples,
  stageToSleepValue,
} from '../healthConnectAggregate';

describe('stageToSleepValue', () => {
  it('maps Health Connect stages onto the sleep values aggregateSleep understands', () => {
    expect(stageToSleepValue(HcSleepStage.DEEP)).toBe(SleepValue.asleepDeep);
    expect(stageToSleepValue(HcSleepStage.REM)).toBe(SleepValue.asleepREM);
    expect(stageToSleepValue(HcSleepStage.LIGHT)).toBe(SleepValue.asleepCore);
    expect(stageToSleepValue(HcSleepStage.SLEEPING)).toBe(SleepValue.asleepUnspecified);
    expect(stageToSleepValue(HcSleepStage.UNKNOWN)).toBe(SleepValue.asleepUnspecified);
    expect(stageToSleepValue(HcSleepStage.AWAKE)).toBe(SleepValue.awake);
    expect(stageToSleepValue(HcSleepStage.AWAKE_IN_BED)).toBe(SleepValue.awake);
  });

  it('ignores out-of-bed and unknown future stage types', () => {
    expect(stageToSleepValue(HcSleepStage.OUT_OF_BED)).toBeNull();
    expect(stageToSleepValue(99)).toBeNull();
  });
});

describe('sleepSessionsToSamples', () => {
  it('turns every stage into a sample and skips out-of-bed time', () => {
    const samples = sleepSessionsToSamples([
      {
        startTime: '2026-11-05T22:00:00Z',
        endTime: '2026-11-06T06:00:00Z',
        stages: [
          { startTime: '2026-11-05T22:00:00Z', endTime: '2026-11-05T23:00:00Z', stage: HcSleepStage.LIGHT },
          { startTime: '2026-11-05T23:00:00Z', endTime: '2026-11-06T01:00:00Z', stage: HcSleepStage.DEEP },
          { startTime: '2026-11-06T01:00:00Z', endTime: '2026-11-06T01:10:00Z', stage: HcSleepStage.OUT_OF_BED },
        ],
      },
    ]);

    expect(samples.map((s) => s.value)).toEqual([SleepValue.asleepCore, SleepValue.asleepDeep]);
  });

  it('counts a session without stages as one block of unspecified sleep', () => {
    const samples = sleepSessionsToSamples([{ startTime: '2026-11-05T22:00:00Z', endTime: '2026-11-06T06:00:00Z' }]);

    expect(samples).toHaveLength(1);
    expect(samples[0].value).toBe(SleepValue.asleepUnspecified);
    expect(samples[0].endDate.getTime() - samples[0].startDate.getTime()).toBe(8 * 3_600_000);
  });

  it('drops samples with unparseable times', () => {
    expect(sleepSessionsToSamples([{ startTime: 'nope', endTime: 'nope' }])).toEqual([]);
  });

  it('feeds aggregateSleep: stages become the night of the day it ends, with efficiency', () => {
    // 7 h 30 in bed: 6 h 30 asleep, 1 h awake -> efficiency 86.7 %.
    const samples = sleepSessionsToSamples([
      {
        startTime: '2026-11-05T21:30:00Z',
        endTime: '2026-11-06T05:00:00Z',
        stages: [
          { startTime: '2026-11-05T21:30:00Z', endTime: '2026-11-05T23:30:00Z', stage: HcSleepStage.LIGHT },
          { startTime: '2026-11-05T23:30:00Z', endTime: '2026-11-06T00:30:00Z', stage: HcSleepStage.AWAKE },
          { startTime: '2026-11-06T00:30:00Z', endTime: '2026-11-06T02:30:00Z', stage: HcSleepStage.DEEP },
          { startTime: '2026-11-06T02:30:00Z', endTime: '2026-11-06T05:00:00Z', stage: HcSleepStage.REM },
        ],
      },
    ]);

    const nights = aggregateSleep(samples);
    const night = nights.get(localDayKey(new Date('2026-11-06T05:00:00Z')));

    expect(night).toMatchObject({
      totalSleepMinutes: 390,
      lightSleepMinutes: 120,
      deepSleepMinutes: 120,
      remSleepMinutes: 150,
      awakeMinutes: 60,
      sleepEfficiencyPct: 86.7,
    });
  });
});

describe('dayValueMapFromGroups', () => {
  const groups = [
    { startTime: '2026-11-04T00:00', result: { COUNT_TOTAL: 8200 } },
    { startTime: '2026-11-05T00:00', result: { COUNT_TOTAL: 0 } },
    { startTime: '2026-11-06T00:00:00', result: { COUNT_TOTAL: 4100.4 } },
    { startTime: 'garbage', result: { COUNT_TOTAL: 99 } },
  ];

  it('keys by the local day in the start time and drops zero (= no data) and malformed groups', () => {
    const map = dayValueMapFromGroups(groups, (r) => r.COUNT_TOTAL);

    expect(Array.from(map.entries())).toEqual([
      ['2026-11-04', 8200],
      ['2026-11-06', 4100.4],
    ]);
  });

  it('survives a missing metric on a result', () => {
    expect(dayValueMapFromGroups([{ startTime: '2026-11-04T00:00', result: {} as { COUNT_TOTAL?: number } }], (r) => r.COUNT_TOTAL).size).toBe(0);
  });
});

describe('averageByLocalDay', () => {
  it('averages per local day and ignores non-positive or invalid readings', () => {
    const a = new Date(2026, 10, 5, 3, 0, 0);
    const b = new Date(2026, 10, 5, 4, 0, 0);
    const c = new Date(2026, 10, 6, 3, 0, 0);

    const map = averageByLocalDay([
      { time: a.toISOString(), value: 40 },
      { time: b.toISOString(), value: 50 },
      { time: b.toISOString(), value: 0 },
      { time: c.toISOString(), value: 35 },
      { time: 'nope', value: 60 },
      { time: c.toISOString(), value: Number.NaN },
    ]);

    expect(map.get('2026-11-05')).toBe(45);
    expect(map.get('2026-11-06')).toBe(35);
    expect(map.size).toBe(2);
  });
});

describe('buildDailySamples with a whole-day energy source (Health Connect)', () => {
  const day = (v: number) => new Map([['2026-11-05', v]]);

  it('uses the reported total when there is no basal figure to add to the active one', () => {
    const out = buildDailySamples({ steps: day(9000), activeCalories: day(450), totalCalories: day(2300) }, '2026-11-01', '2026-11-06');
    expect(out).toEqual([{ date: '2026-11-05', steps: 9000, activeCalories: 450, totalCalories: 2300 }]);
  });

  it('reports total calories on a day that has only that metric', () => {
    const out = buildDailySamples({ totalCalories: day(2100.4) }, '2026-11-01', '2026-11-06');
    expect(out).toEqual([{ date: '2026-11-05', totalCalories: 2100 }]);
  });

  it('keeps active + basal for HealthKit when both exist (the reported total is only a fallback)', () => {
    const out = buildDailySamples(
      { activeCalories: day(400), basalCalories: day(1700), totalCalories: day(9999) },
      '2026-11-01',
      '2026-11-06',
    );
    expect(out[0].totalCalories).toBe(2100);
  });
});
