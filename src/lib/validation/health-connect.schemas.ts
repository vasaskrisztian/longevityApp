import type { z } from 'zod';
import { AppleHealthDailySampleSchema, AppleHealthIngestSchema } from './apple-health.schemas';

/**
 * Health Connect (Android) is, like Apple Health, device-only data: the app
 * reads it on the phone, aggregates it into one summary per local calendar day
 * and pushes a batch here. The aggregated shape is exactly the one the iPhone
 * sends (steps, calories, resting heart rate, HRV, sleep stages …), so the
 * schema is shared instead of copied — a change to one is a change to both.
 */
export const HealthConnectDailySampleSchema = AppleHealthDailySampleSchema;
export const HealthConnectIngestSchema = AppleHealthIngestSchema;

export type HealthConnectIngestInput = z.infer<typeof HealthConnectIngestSchema>;
