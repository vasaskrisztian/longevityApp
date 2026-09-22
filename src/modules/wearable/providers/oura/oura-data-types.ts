/**
 * Oura's own v2 `usercollection` wire shapes for the data types this app
 * ingests. Nothing outside this directory may import this file — enforced
 * by .eslintrc.json's no-restricted-imports rule, same as oura-types.ts.
 *
 * These field names are modeled on Oura's public v2 API documentation,
 * consolidated to match what this app's `DailyHealthMetric` schema actually
 * needs (e.g. `daily_sleep` here also carries the sleep-duration/HRV/resting-
 * heart-rate detail Oura's real API splits into a separate `sleep` endpoint)
 * — this is a deliberate simplification for the MVP, not a transcription of
 * Oura's docs. Nothing in this sandbox can verify field names against a live
 * Oura account (see docs/phase-4-summary.md's Known limitations); the mock
 * generator in oura-ingestion-mock.ts produces exactly this shape, so the
 * mapper in oura-mappers.ts is internally consistent regardless. Revisit
 * against Oura's live API docs before the first production sync.
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
}

export interface OuraDailySpo2Record {
  id: string;
  day: string;
  spo2_percentage: { average: number };
}
