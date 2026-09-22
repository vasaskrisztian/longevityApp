import type { FetchRawDataResult, ProviderRawRecord } from '../../domain/wearable-provider.types';
import type {
  OuraDailyActivityRecord,
  OuraDailyReadinessRecord,
  OuraDailySleepRecord,
  OuraDailySpo2Record,
  OuraHeartRateRecord,
  OuraWorkoutRecord,
} from './oura-data-types';

/**
 * `OURA_MOCK_MODE=true`'s ingestion side (the OAuth mock lives in
 * oura-mock.ts). Per ARCHITECTURE.md §11: generates sleep/readiness/
 * activity/HRV/resting-HR/steps/calories/SpO2/workout data for every day in
 * the requested [from, to] window — the caller decides the window size (a
 * 30-day initial-sync request naturally produces ≥30 days of data, per the
 * architecture doc's requirement, without this module hard-coding "30").
 * Zero network calls; never fails, so `failures` is always empty here.
 */

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function enumerateDays(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cursor = utcMidnight(from);
  const end = utcMidnight(to);
  while (cursor.getTime() <= end.getTime()) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function dayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number): number {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

function mockSleepRecord(day: Date): ProviderRawRecord {
  const key = dayKey(day);
  const bedtimeStart = new Date(day.getTime() - 2 * 60 * 60 * 1000); // 22:00 the previous UTC day
  const totalSleepDuration = randomInt(5.5 * 3600, 8.5 * 3600);
  const deepSleepDuration = Math.round(totalSleepDuration * randomFloat(0.12, 0.22, 3));
  const remSleepDuration = Math.round(totalSleepDuration * randomFloat(0.15, 0.25, 3));
  const lightSleepDuration = Math.max(
    0,
    totalSleepDuration - deepSleepDuration - remSleepDuration,
  );
  const awakeTime = randomInt(0, 40 * 60);
  const bedtimeEnd = new Date(bedtimeStart.getTime() + (totalSleepDuration + awakeTime) * 1000);

  const payload: OuraDailySleepRecord = {
    id: `mock-sleep-${key}`,
    day: key,
    score: randomInt(55, 95),
    total_sleep_duration: totalSleepDuration,
    deep_sleep_duration: deepSleepDuration,
    rem_sleep_duration: remSleepDuration,
    light_sleep_duration: lightSleepDuration,
    awake_time: awakeTime,
    efficiency: randomInt(78, 97),
    latency: randomInt(2 * 60, 25 * 60),
    bedtime_start: bedtimeStart.toISOString(),
    bedtime_end: bedtimeEnd.toISOString(),
    lowest_heart_rate: randomInt(45, 62),
    average_hrv: randomInt(28, 75),
  };
  return { dataType: 'DAILY_SLEEP', externalId: payload.id, dataDate: day, payload };
}

function mockReadinessRecord(day: Date): ProviderRawRecord {
  const key = dayKey(day);
  const payload: OuraDailyReadinessRecord = {
    id: `mock-readiness-${key}`,
    day: key,
    score: randomInt(50, 95),
    temperature_deviation: randomFloat(-0.6, 0.6, 2),
  };
  return { dataType: 'DAILY_READINESS', externalId: payload.id, dataDate: day, payload };
}

function mockActivityRecord(day: Date): ProviderRawRecord {
  const key = dayKey(day);
  const steps = randomInt(2000, 15000);
  const payload: OuraDailyActivityRecord = {
    id: `mock-activity-${key}`,
    day: key,
    score: randomInt(45, 95),
    steps,
    active_calories: randomInt(150, 900),
    total_calories: randomInt(1600, 3200),
    walking_equivalent_minutes: Math.round(steps / 120),
    sedentary_minutes: randomInt(300, 780),
  };
  return { dataType: 'DAILY_ACTIVITY', externalId: payload.id, dataDate: day, payload };
}

function mockSpo2Record(day: Date): ProviderRawRecord {
  const key = dayKey(day);
  const payload: OuraDailySpo2Record = {
    id: `mock-spo2-${key}`,
    day: key,
    spo2_percentage: { average: randomFloat(94, 99, 1) },
  };
  return { dataType: 'SPO2', externalId: payload.id, dataDate: day, payload };
}

function mockHeartRateRecord(day: Date, sampleIndex: number): ProviderRawRecord {
  const timestamp = new Date(day.getTime() + sampleIndex * 5 * 60 * 1000).toISOString();
  const payload: OuraHeartRateRecord = {
    bpm: randomInt(48, 130),
    source: 'mock',
    timestamp,
  };
  return { dataType: 'HEART_RATE', externalId: timestamp, dataDate: day, payload };
}

function mockWorkoutRecord(day: Date): ProviderRawRecord {
  const key = dayKey(day);
  const startedAt = new Date(day.getTime() + 17 * 60 * 60 * 1000); // ~17:00 UTC
  const durationMinutes = randomInt(20, 75);
  const endedAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
  const activities = ['running', 'cycling', 'strength_training', 'swimming', 'yoga'];
  const payload: OuraWorkoutRecord = {
    id: `mock-workout-${key}`,
    activity: activities[randomInt(0, activities.length - 1)]!,
    start_datetime: startedAt.toISOString(),
    end_datetime: endedAt.toISOString(),
    calories: randomInt(120, 650),
    distance: Math.random() < 0.7 ? randomInt(1500, 12000) : null,
    intensity: ['easy', 'moderate', 'hard'][randomInt(0, 2)]!,
  };
  return { dataType: 'WORKOUT', externalId: payload.id, dataDate: day, payload };
}

export function mockFetchRawData(from: Date, to: Date): FetchRawDataResult {
  const days = enumerateDays(from, to);
  const records: ProviderRawRecord[] = [];

  days.forEach((day, index) => {
    records.push(mockSleepRecord(day));
    records.push(mockReadinessRecord(day));
    records.push(mockActivityRecord(day));
    records.push(mockSpo2Record(day));
    // A handful of intraday heart-rate samples per day — real Oura data is
    // 5-minute resolution across the whole day; a few samples are enough to
    // exercise storage/idempotency without generating thousands of rows.
    for (let sample = 0; sample < 3; sample += 1) {
      records.push(mockHeartRateRecord(day, sample));
    }
    // Not every day has a workout.
    if (index % 3 === 0) {
      records.push(mockWorkoutRecord(day));
    }
  });

  return { records, failures: [] };
}
