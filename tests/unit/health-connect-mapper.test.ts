import { describe, it, expect } from 'vitest';
import {
  healthConnectSampleToRawRecord,
  mapHealthConnectRecordToDailyMetric,
} from '@/modules/wearable/providers/health-connect/health-connect-mapper';
import { HealthConnectIngestSchema } from '@/lib/validation/health-connect.schemas';

describe('Health Connect mapping', () => {
  it('builds a deterministic per-day raw record so re-pushing a day upserts instead of duplicating', () => {
    const first = healthConnectSampleToRawRecord({ date: '2026-11-01', steps: 4000 });
    const second = healthConnectSampleToRawRecord({ date: '2026-11-01', steps: 4100, restingHeartRate: 60 });

    expect(first.dataType).toBe('OTHER');
    expect(first.externalId).toBe('daily-summary-2026-11-01');
    expect(second.externalId).toBe(first.externalId);
  });

  it('maps a daily summary onto the normalized daily metric fields', () => {
    const record = healthConnectSampleToRawRecord({
      date: '2026-11-01',
      steps: 9000,
      activeCalories: 400,
      totalCalories: 2200,
      restingHeartRate: 55,
      averageHrv: 41.5,
      totalSleepMinutes: 430,
      deepSleepMinutes: 80,
      remSleepMinutes: 95,
      lightSleepMinutes: 255,
      awakeMinutes: 25,
      sleepEfficiencyPct: 94.5,
    });

    const metric = mapHealthConnectRecordToDailyMetric(record);

    expect(metric?.date).toEqual(new Date('2026-11-01'));
    expect(metric?.fields).toMatchObject({
      steps: 9000,
      activeCalories: 400,
      totalCalories: 2200,
      restingHeartRate: 55,
      averageHrv: 41.5,
      totalSleepMinutes: 430,
      deepSleepMinutes: 80,
      remSleepMinutes: 95,
      lightSleepMinutes: 255,
      awakeMinutes: 25,
      sleepEfficiencyPct: 94.5,
    });
  });

  it('ignores records of another data type', () => {
    expect(
      mapHealthConnectRecordToDailyMetric({
        dataType: 'DAILY_SLEEP',
        externalId: 'x',
        dataDate: new Date('2026-11-01'),
        payload: { date: '2026-11-01' },
      }),
    ).toBeNull();
  });
});

describe('HealthConnectIngestSchema', () => {
  it('accepts up to 180 daily samples and rejects empty, oversized or malformed batches', () => {
    const sample = { date: '2026-11-01', steps: 1 };
    expect(HealthConnectIngestSchema.safeParse({ samples: [sample] }).success).toBe(true);
    expect(HealthConnectIngestSchema.safeParse({ samples: [] }).success).toBe(false);
    expect(HealthConnectIngestSchema.safeParse({ samples: Array(181).fill(sample) }).success).toBe(false);
    expect(HealthConnectIngestSchema.safeParse({ samples: [{ date: '11/01/2026' }] }).success).toBe(false);
  });
});
