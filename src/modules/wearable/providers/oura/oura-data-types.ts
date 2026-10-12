/**
 * Oura's own v2 `usercollection` wire shapes for the data types this app
 * ingests. Nothing outside this directory may import this file — enforced
 * by .eslintrc.json's no-restricted-imports rule, same as oura-types.ts.
 *
 * IMPORTANT (confirmed against the live production payloads, 2026-10): the
 * real `daily_sleep` endpoint returns ONLY `id, day, score, timestamp,
 * contributors` — no durations, no HRV, no resting heart rate. Those live on
 * the separate `sleep` endpoint (one record per sleep period, see
 * `OuraSleepSessionRecord`). `OuraDailySleepRecord` below still lists the
 * detail fields because the mock generator (oura-ingestion-mock.ts) emits
 * them and the mapper tolerates them, but for a real account they are always
 * absent: the sleep duration / HRV / resting heart rate come from the
 * `sleep` endpoint via `OuraSleepSessionRecord`.
 */

export interface OuraDailySleepRecord {
  id: string;
  day: string; // YYYY-MM-DD
  score: number; // 0-100
  total_sleep_duration: number; // seconds
  deep_sleep_duration: number; // seconds
  rem_sleep_duration: number; // seconds
  light_sleep_duration: number; // seconds
  awake_time: number; // seconds
  efficiency: number; // 0-100 (%)
  latency: number; // seconds
  bedtime_start: string; // ISO datetime
  bedtime_end: string; // ISO datetime
  lowest_heart_rate: number; // bpm — used as this app's restingHeartRate
  average_hrv: number; // ms
}

/**
 * One record of Oura's `sleep` endpoint — a single sleep period (a night, a
 * nap, ...). A day can have several; `pickPrimarySleepSessions` in
 * oura-mappers.ts selects the one that represents the night.
 */
export interface OuraSleepSessionRecord {
  id: string;
  day: string; // YYYY-MM-DD (the day the period belongs to)
  /** 'long_sleep' (the main night), 'sleep', 'late_nap', 'rest' or 'deleted'. */
  type?: string;
  total_sleep_duration?: number | null; // seconds
  deep_sleep_duration?: number | null;
  rem_sleep_duration?: number | null;
  light_sleep_duration?: number | null;
  awake_time?: number | null;
  efficiency?: number | null; // 0-100 (%)
  latency?: number | null; // seconds
  bedtime_start?: string;
  bedtime_end?: string;
  lowest_heart_rate?: number | null; // bpm — used as this app's restingHeartRate
  average_hrv?: number | null; // ms
}

export interface OuraDailyReadinessRecord {
  id: string;
  day: string;
  score: number; // 0-100
  temperature_deviation: number; // degrees C from baseline
}

export interface OuraDailyActivityRecord {
  id: string;
  day: string;
  score: number; // 0-100
  steps: number;
  active_calories: number;
  total_calories: number;
  walking_equivalent_minutes: number;
  sedentary_minutes: number;
}

/** A single intraday sample — many rows per day, not one. */
export interface OuraHeartRateRecord {
  bpm: number;
  source: string;
  timestamp: string; // ISO datetime
}

export interface OuraWorkoutRecord {
  id: string;
  activity: string;
  start_datetime: string; // ISO datetime
  end_datetime: string; // ISO datetime
  calories: number | null;
  distance: number | null; // meters
  intensity: string | null;
  /** manual | autodetected | confirmed | workout_heart_rate */
  source?: string | null;
}

export interface OuraDailySpo2Record {
  id: string;
  day: string;
  spo2_percentage: { average: number };
}
