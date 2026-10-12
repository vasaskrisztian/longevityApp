import { describe, it, expect } from 'vitest';
import {
  mapOuraRecordToDailyMetric,
  mapOuraRecordToWorkout,
  pickPrimarySleepSessions,
} from '@/modules/wearable/providers/oura/oura-mappers';
import type { ProviderRawRecord } from '@/modules/wearable/domain/wearable-provider.types';

const DAY = new Date('2026-01-15T00:00:00Z');

function rawRecord(overrides: Partial<ProviderRawRecord>): ProviderRawRecord {
  return {
    dataType: 'OTHER',
    externalId: 'x',
    dataDate: DAY,
    payload: {},
    ...overrides,
  };
}

describe('mapOuraRecordToDailyMetric', () => {
  it('maps DAILY_SLEEP: durations from seconds to minutes, resting HR from lowest_heart_rate, bedtimes parsed', () => {
    const record = rawRecord({
      dataType: 'DAILY_SLEEP',
      payload: {
        id: 's1',
        day: '2026-01-15',
        score: 82,
        total_sleep_duration: 7 * 3600,
        deep_sleep_duration: 3600,
        rem_sleep_duration: 5400,
        light_sleep_duration: 7 * 3600 - 3600 - 5400,
        awake_time: 600,
        efficiency: 91,
        latency: 300,
        bedtime_start: '2026-01-14T22:00:00Z',
        bedtime_end: '2026-01-15T06:10:00Z',
        lowest_heart_rate: 52,
        average_hrv: 60,
      },
    });

    const result = mapOuraRecordToDailyMetric(record);

    expect(result).not.toBeNull();
    expect(result!.date).toBe(DAY);
    expect(result!.fields).toEqual({
      sleepScore: 82,
      totalSleepMinutes: 420,
      deepSleepMinutes: 60,
      remSleepMinutes: 90,
      lightSleepMinutes: 270,
      awakeMinutes: 10,
      sleepEfficiencyPct: 91,
      sleepLatencyMinutes: 5,
      bedtimeStart: new Date('2026-01-14T22:00:00Z'),
      bedtimeEnd: new Date('2026-01-15T06:10:00Z'),
      restingHeartRate: 52,
      averageHrv: 60,
    });
  });

  it('maps DAILY_READINESS: score and temperature deviation', () => {
    const record = rawRecord({
      dataType: 'DAILY_READINESS',
      payload: { id: 'r1', day: '2026-01-15', score: 77, temperature_deviation: -0.2 },
    });

    expect(mapOuraRecordToDailyMetric(record)).toEqual({
      date: DAY,
      fields: { readinessScore: 77, temperatureDeviationC: -0.2 },
    });
  });

  it('maps DAILY_ACTIVITY: score, steps, calories, walking-equivalent, sedentary minutes', () => {
    const record = rawRecord({
      dataType: 'DAILY_ACTIVITY',
      payload: {
        id: 'a1',
        day: '2026-01-15',
        score: 68,
        steps: 9000,
        active_calories: 420,
        total_calories: 2400,
        walking_equivalent_minutes: 75,
        sedentary_minutes: 500,
      },
    });

    expect(mapOuraRecordToDailyMetric(record)).toEqual({
      date: DAY,
      fields: {
        activityScore: 68,
        steps: 9000,
        activeCalories: 420,
        totalCalories: 2400,
        walkingEquivalentMin: 75,
        sedentaryMinutes: 500,
      },
    });
  });

  it('maps SPO2: average percentage', () => {
    const record = rawRecord({
      dataType: 'SPO2',
      payload: { id: 'sp1', day: '2026-01-15', spo2_percentage: { average: 97.4 } },
    });

    expect(mapOuraRecordToDailyMetric(record)).toEqual({
      date: DAY,
      fields: { spo2Average: 97.4 },
    });
  });

  it('maps a real daily_sleep payload (score + contributors only) to just the sleep score', () => {
    const record = rawRecord({
      dataType: 'DAILY_SLEEP',
      payload: { id: 's1', day: '2026-01-15', score: 82, timestamp: '2026-01-15T00:00:00+00:00', contributors: { deep_sleep: 70 } },
    });

    expect(mapOuraRecordToDailyMetric(record)!.fields).toEqual({ sleepScore: 82 });
  });

  it('maps an Oura sleep period (stored as OTHER): durations, HRV and resting HR from the `sleep` endpoint', () => {
    const record = rawRecord({
      dataType: 'OTHER',
      payload: {
        id: 'p1',
        day: '2026-01-15',
        type: 'long_sleep',
        total_sleep_duration: 7 * 3600,
        deep_sleep_duration: 3600,
        rem_sleep_duration: 5400,
        light_sleep_duration: 7 * 3600 - 3600 - 5400,
        awake_time: 600,
        efficiency: 91,
        latency: 300,
        bedtime_start: '2026-01-14T22:00:00Z',
        bedtime_end: '2026-01-15T06:10:00Z',
        lowest_heart_rate: 48,
        average_hrv: 63,
      },
    });

    expect(mapOuraRecordToDailyMetric(record)).toEqual({
      date: DAY,
      fields: {
        totalSleepMinutes: 420,
        deepSleepMinutes: 60,
        remSleepMinutes: 90,
        lightSleepMinutes: 270,
        awakeMinutes: 10,
        sleepEfficiencyPct: 91,
        sleepLatencyMinutes: 5,
        bedtimeStart: new Date('2026-01-14T22:00:00Z'),
        bedtimeEnd: new Date('2026-01-15T06:10:00Z'),
        restingHeartRate: 48,
        averageHrv: 63,
      },
    });
  });

  it('leaves out values Oura could not measure (null) instead of writing 0 or NaN', () => {
    const record = rawRecord({
      dataType: 'OTHER',
      payload: { id: 'p2', day: '2026-01-15', type: 'long_sleep', total_sleep_duration: 6 * 3600, average_hrv: null, lowest_heart_rate: null },
    });

    const fields = mapOuraRecordToDailyMetric(record)!.fields;

    expect(fields.totalSleepMinutes).toBe(360);
    expect(fields.averageHrv).toBeUndefined();
    expect(fields.restingHeartRate).toBeUndefined();
  });

  it('returns null for HEART_RATE, WORKOUT, and OTHER — no daily-metric field targets them', () => {
    expect(mapOuraRecordToDailyMetric(rawRecord({ dataType: 'HEART_RATE' }))).toBeNull();
    expect(mapOuraRecordToDailyMetric(rawRecord({ dataType: 'WORKOUT' }))).toBeNull();
    expect(mapOuraRecordToDailyMetric(rawRecord({ dataType: 'OTHER' }))).toBeNull();
  });
});

describe('mapOuraRecordToWorkout', () => {
  it('maps a WORKOUT record, computing durationMin from start/end', () => {
    const record = rawRecord({
      dataType: 'WORKOUT',
      externalId: 'w1',
      payload: {
        id: 'w1',
        activity: 'running',
        start_datetime: '2026-01-15T17:00:00Z',
        end_datetime: '2026-01-15T17:45:00Z',
        calories: 380,
        distance: 7500,
        intensity: 'moderate',
        source: 'autodetected',
      },
    });

    expect(mapOuraRecordToWorkout(record)).toEqual({
      externalId: 'w1',
      activityType: 'running',
      startedAt: new Date('2026-01-15T17:00:00Z'),
      endedAt: new Date('2026-01-15T17:45:00Z'),
      durationMin: 45,
      calories: 380,
      distanceM: 7500,
      intensity: 'moderate',
      source: 'autodetected',
    });
  });

  it('maps null calories/distance/intensity to undefined', () => {
    const record = rawRecord({
      dataType: 'WORKOUT',
      externalId: 'w2',
      payload: {
        id: 'w2',
        activity: 'yoga',
        start_datetime: '2026-01-15T08:00:00Z',
        end_datetime: '2026-01-15T08:30:00Z',
        calories: null,
        distance: null,
        intensity: null,
      },
    });

    const result = mapOuraRecordToWorkout(record);

    expect(result!.calories).toBeUndefined();
    expect(result!.distanceM).toBeUndefined();
    expect(result!.intensity).toBeUndefined();
    expect(result!.source).toBeUndefined();
  });

  it('returns null for any non-WORKOUT dataType', () => {
    expect(mapOuraRecordToWorkout(rawRecord({ dataType: 'DAILY_SLEEP' }))).toBeNull();
  });
});

describe('pickPrimarySleepSessions', () => {
  const session = (id: string, day: string, type: string | undefined, total: number) => ({
    id,
    day,
    ...(type ? { type } : {}),
    total_sleep_duration: total,
  });

  it('keeps one record per day: the longest long_sleep', () => {
    const picked = pickPrimarySleepSessions([
      session('a', '2026-01-15', 'long_sleep', 6 * 3600),
      session('b', '2026-01-15', 'long_sleep', 7 * 3600),
      session('c', '2026-01-16', 'long_sleep', 8 * 3600),
    ]);

    expect(picked.map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('never lets a nap, a rest period or a deleted record stand in for the night', () => {
    const picked = pickPrimarySleepSessions([
      session('nap', '2026-01-15', 'late_nap', 9 * 3600),
      session('rest', '2026-01-15', 'rest', 9 * 3600),
      session('gone', '2026-01-15', 'deleted', 9 * 3600),
      session('night', '2026-01-15', 'long_sleep', 5 * 3600),
      session('nap-only', '2026-01-16', 'late_nap', 3600),
    ]);

    expect(picked.map((p) => p.id)).toEqual(['night']);
  });

  it('prefers long_sleep over sleep, and treats a missing type as sleep', () => {
    expect(
      pickPrimarySleepSessions([session('s', '2026-01-15', 'sleep', 9 * 3600), session('l', '2026-01-15', 'long_sleep', 4 * 3600)]).map((p) => p.id),
    ).toEqual(['l']);
    expect(pickPrimarySleepSessions([session('old', '2026-01-15', undefined, 7 * 3600)]).map((p) => p.id)).toEqual(['old']);
  });

  it('returns the days oldest first', () => {
    const picked = pickPrimarySleepSessions([
      session('b', '2026-01-16', 'long_sleep', 7 * 3600),
      session('a', '2026-01-15', 'long_sleep', 7 * 3600),
    ]);

    expect(picked.map((p) => p.day)).toEqual(['2026-01-15', '2026-01-16']);
  });
});
