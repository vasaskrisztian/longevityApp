import { describe, it, expect } from 'vitest';
import {
  appleHealthSampleToRawRecord,
  mapAppleHealthRecordToDailyMetric,
} from '@/modules/wearable/providers/apple-health/apple-health-mapper';

describe('appleHealthSampleToRawRecord', () => {
  it('tags the record OTHER and builds a deterministic per-day externalId', () => {
    const record = appleHealthSampleToRawRecord({ date: '2026-02-01', steps: 5000 });

    expect(record.dataType).toBe('OTHER');
    expect(record.externalId).toBe('daily-summary-2026-02-01');
    expect(record.dataDate).toEqual(new Date('2026-02-01'));
    expect(record.payload).toEqual({ date: '2026-02-01', steps: 5000 });
  });

  it('produces the same externalId for the same date, regardless of which fields are present — re-pushing a day upserts, never duplicates', () => {
    const first = appleHealthSampleToRawRecord({ date: '2026-02-01', steps: 5000 });
    const second = appleHealthSampleToRawRecord({ date: '2026-02-01', steps: 5200, restingHeartRate: 60 });

    expect(first.externalId).toBe(second.externalId);
  });
});

describe('mapAppleHealthRecordToDailyMetric', () => {
  it('returns null for a dataType other than OTHER', () => {
    const result = mapAppleHealthRecordToDailyMetric({
      dataType: 'DAILY_SLEEP',
      externalId: 'x',
      dataDate: new Date('2026-02-01'),
      payload: { date: '2026-02-01' },
    });

    expect(result).toBeNull();
  });

  it('passes every normalized field straight through unchanged', () => {
    const bedtimeStart = new Date('2026-02-01T23:00:00Z');
    const bedtimeEnd = new Date('2026-02-02T07:00:00Z');
    const record = appleHealthSampleToRawRecord({
      date: '2026-02-01',
      steps: 9000,
      activeCalories: 400,
      totalCalories: 2200,
      restingHeartRate: 55,
      averageHrv: 48.5,
      totalSleepMinutes: 420,
      deepSleepMinutes: 90,
      remSleepMinutes: 100,
      lightSleepMinutes: 220,
      awakeMinutes: 10,
      sleepEfficiencyPct: 92.3,
      bedtimeStart,
      bedtimeEnd,
    });

    const result = mapAppleHealthRecordToDailyMetric(record);

    expect(result).not.toBeNull();
    expect(result?.date).toEqual(new Date('2026-02-01'));
    expect(result?.fields).toEqual({
      steps: 9000,
      activeCalories: 400,
      totalCalories: 2200,
      restingHeartRate: 55,
      averageHrv: 48.5,
      totalSleepMinutes: 420,
      deepSleepMinutes: 90,
      remSleepMinutes: 100,
      lightSleepMinutes: 220,
      awakeMinutes: 10,
      sleepEfficiencyPct: 92.3,
      bedtimeStart,
      bedtimeEnd,
    });
  });

  it('leaves absent fields undefined rather than inventing a placeholder — a steps-only day contributes only steps', () => {
    const record = appleHealthSampleToRawRecord({ date: '2026-02-01', steps: 9000 });

    const result = mapAppleHealthRecordToDailyMetric(record);

    expect(result?.fields.steps).toBe(9000);
    expect(result?.fields.totalSleepMinutes).toBeUndefined();
    expect(result?.fields.restingHeartRate).toBeUndefined();
  });
});
