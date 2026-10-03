import { z } from 'zod';

/**
 * Apple Health/HealthKit has no cloud API the backend can pull from (unlike
 * Oura's REST+OAuth integration) — see claude/phase-15-mobile-migration-plan.md's
 * phase 19 notes. The device itself queries HealthKit, aggregates the
 * results into one summary per calendar day (steps, sleep stages, resting
 * heart rate, HRV, …), and pushes a batch of those daily summaries here.
 * This schema is exactly that per-day shape — already-aggregated fields,
 * not raw HKSample arrays — so the backend never needs to understand
 * HealthKit's own sample/unit model, only this one normalized shape.
 *
 * Every field but `date` is optional: a given day's batch only includes
 * whatever HealthKit actually had data for (e.g. no sleep fields on a day
 * the user didn't wear a sleep-tracking device at all).
 */
export const AppleHealthDailySampleSchema = z.object({
  /** Calendar day this sample summarizes, as "yyyy-mm-dd" (device-local calendar day). */
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be yyyy-mm-dd'),

  steps: z.coerce.number().int().min(0).max(200_000).optional(),
  activeCalories: z.coerce.number().min(0).max(20_000).optional(),
  totalCalories: z.coerce.number().min(0).max(20_000).optional(),

  restingHeartRate: z.coerce.number().int().min(20).max(250).optional(),
  averageHrv: z.coerce.number().min(0).max(500).optional(),

  totalSleepMinutes: z.coerce.number().int().min(0).max(1_440).optional(),
  deepSleepMinutes: z.coerce.number().int().min(0).max(1_440).optional(),
  remSleepMinutes: z.coerce.number().int().min(0).max(1_440).optional(),
  lightSleepMinutes: z.coerce.number().int().min(0).max(1_440).optional(),
  awakeMinutes: z.coerce.number().int().min(0).max(1_440).optional(),
  sleepEfficiencyPct: z.coerce.number().min(0).max(100).optional(),
  bedtimeStart: z.coerce.date().optional(),
  bedtimeEnd: z.coerce.date().optional(),
});

export type AppleHealthDailySampleInput = z.infer<typeof AppleHealthDailySampleSchema>;

// A historical backfill on first connect can reasonably cover a few months;
// an ongoing background sync sends a handful of recent days. 180 is
// generous for either without accepting an unbounded request body.
export const AppleHealthIngestSchema = z.object({
  samples: z.array(AppleHealthDailySampleSchema).min(1).max(180),
});

export type AppleHealthIngestInput = z.infer<typeof AppleHealthIngestSchema>;
