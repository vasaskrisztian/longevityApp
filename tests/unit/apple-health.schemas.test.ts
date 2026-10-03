import { describe, it, expect } from 'vitest';
import { AppleHealthDailySampleSchema, AppleHealthIngestSchema } from '@/lib/validation/apple-health.schemas';

describe('AppleHealthDailySampleSchema', () => {
  it('accepts a minimal sample with only a date', () => {
    expect(AppleHealthDailySampleSchema.safeParse({ date: '2026-01-15' }).success).toBe(true);
  });

  it('accepts a fully populated sample', () => {
    const result = AppleHealthDailySampleSchema.safeParse({
      date: '2026-01-15',
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
      bedtimeStart: '2026-01-14T23:00:00.000Z',
      bedtimeEnd: '2026-01-15T07:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bedtimeStart).toBeInstanceOf(Date);
    }
  });

  it('rejects a malformed date', () => {
    expect(AppleHealthDailySampleSchema.safeParse({ date: '01/15/2026' }).success).toBe(false);
    expect(AppleHealthDailySampleSchema.safeParse({ date: 'not-a-date' }).success).toBe(false);
  });

  it('rejects an out-of-range resting heart rate', () => {
    expect(AppleHealthDailySampleSchema.safeParse({ date: '2026-01-15', restingHeartRate: 5 }).success).toBe(
      false,
    );
    expect(AppleHealthDailySampleSchema.safeParse({ date: '2026-01-15', restingHeartRate: 999 }).success).toBe(
      false,
    );
  });

  it('rejects negative steps', () => {
    expect(AppleHealthDailySampleSchema.safeParse({ date: '2026-01-15', steps: -1 }).success).toBe(false);
  });

  it('rejects sleep minutes over a full day', () => {
    expect(
      AppleHealthDailySampleSchema.safeParse({ date: '2026-01-15', totalSleepMinutes: 1_500 }).success,
    ).toBe(false);
  });
});

describe('AppleHealthIngestSchema', () => {
  it('accepts a batch of valid samples', () => {
    const result = AppleHealthIngestSchema.safeParse({
      samples: [{ date: '2026-01-14', steps: 1000 }, { date: '2026-01-15', steps: 2000 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty samples array', () => {
    expect(AppleHealthIngestSchema.safeParse({ samples: [] }).success).toBe(false);
  });

  it('rejects a batch over the 180-sample cap', () => {
    const samples = Array.from({ length: 181 }, (_, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}` }));
    expect(AppleHealthIngestSchema.safeParse({ samples }).success).toBe(false);
  });

  it('rejects a batch containing one invalid sample', () => {
    const result = AppleHealthIngestSchema.safeParse({
      samples: [{ date: '2026-01-14' }, { date: 'garbage' }],
    });
    expect(result.success).toBe(false);
  });
});
