import { describe, it, expect } from 'vitest';
import { mockFetchRawData } from '@/modules/wearable/providers/oura/oura-ingestion-mock';

describe('mockFetchRawData', () => {
  it('never fails — failures is always empty', () => {
    const result = mockFetchRawData(new Date('2026-01-01'), new Date('2026-01-01'));
    expect(result.failures).toEqual([]);
  });

  it('generates one of each daily data type per day in the window, inclusive of both ends', () => {
    const result = mockFetchRawData(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-03T00:00:00Z'));

    const byType = new Map<string, number>();
    for (const record of result.records) {
      byType.set(record.dataType, (byType.get(record.dataType) ?? 0) + 1);
    }

    // 3 days requested (Jan 1, 2, 3 inclusive)
    expect(byType.get('DAILY_SLEEP')).toBe(3);
    expect(byType.get('DAILY_READINESS')).toBe(3);
    expect(byType.get('DAILY_ACTIVITY')).toBe(3);
    expect(byType.get('SPO2')).toBe(3);
  });

  it('satisfies the >=30-day mock-data requirement (ARCHITECTURE.md §11) for a 30-day window', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-30T00:00:00Z'); // 30 days inclusive
    const result = mockFetchRawData(from, to);

    const sleepDays = new Set(
      result.records.filter((r) => r.dataType === 'DAILY_SLEEP').map((r) => r.dataDate.toISOString()),
    );
    expect(sleepDays.size).toBe(30);
  });

  it('produces multiple intraday heart-rate samples per day', () => {
    const result = mockFetchRawData(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));
    const heartRateRecords = result.records.filter((r) => r.dataType === 'HEART_RATE');
    expect(heartRateRecords.length).toBeGreaterThan(1);
  });

  it('not every day gets a workout, but some days do across a multi-day window', () => {
    const result = mockFetchRawData(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-06T00:00:00Z'));
    const workoutDays = result.records.filter((r) => r.dataType === 'WORKOUT').length;
    expect(workoutDays).toBeGreaterThan(0);
    expect(workoutDays).toBeLessThan(6);
  });

  it('every record carries a stable externalId and a dataDate within the requested window', () => {
    const from = new Date('2026-02-01T00:00:00Z');
    const to = new Date('2026-02-02T00:00:00Z');
    const result = mockFetchRawData(from, to);

    for (const record of result.records) {
      expect(record.externalId.length).toBeGreaterThan(0);
      expect(record.dataDate.getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(record.dataDate.getTime()).toBeLessThanOrEqual(to.getTime());
    }
  });

  it('generates fresh values on every call (no shared mutable state across calls)', () => {
    const a = mockFetchRawData(new Date('2026-01-01'), new Date('2026-01-01'));
    const b = mockFetchRawData(new Date('2026-01-01'), new Date('2026-01-01'));
    const sleepA = a.records.find((r) => r.dataType === 'DAILY_SLEEP')!.payload as { score: number };
    const sleepB = b.records.find((r) => r.dataType === 'DAILY_SLEEP')!.payload as { score: number };
    // Not a hard guarantee (random can coincide), but astronomically unlikely
    // across enough fields — check a few fields together.
    const readinessA = a.records.find((r) => r.dataType === 'DAILY_READINESS')!.payload as {
      temperature_deviation: number;
    };
    const readinessB = b.records.find((r) => r.dataType === 'DAILY_READINESS')!.payload as {
      temperature_deviation: number;
    };
    const identical =
      sleepA.score === sleepB.score && readinessA.temperature_deviation === readinessB.temperature_deviation;
    expect(identical).toBe(false);
  });
});
