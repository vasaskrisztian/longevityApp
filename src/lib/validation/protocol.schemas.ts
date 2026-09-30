import { z } from 'zod';
import { SupplementFrequencyEnum, SupplementTimingEnum } from './supplement.schemas';

/**
 * One supplement target line inside a protocol. `id` is only ever present
 * on a row that already exists (an edit round-trip echoing it back) —
 * protocols.service.ts strips it before writing, since the whole list is
 * replaced wholesale on every save rather than diffed row-by-row.
 */
export const ProtocolSupplementSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  dosage: z.coerce.number().positive('Dosage must be greater than 0').max(1_000_000).optional(),
  unit: z.string().trim().max(20).optional(),
  frequency: SupplementFrequencyEnum.optional(),
  timing: SupplementTimingEnum.optional(),
});

export type ProtocolSupplementInput = z.infer<typeof ProtocolSupplementSchema>;

export const CreateProtocolSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().default(false),
  // 0-100 Oura-style score.
  targetSleepScore: z.coerce.number().int().min(0).max(100).optional(),
  // Minutes, capped at 24h.
  targetSleepMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  targetWeeklyWorkouts: z.coerce.number().int().min(0).max(50).optional(),
  targetDailyActiveCalories: z.coerce.number().int().min(0).max(20_000).optional(),
  supplements: z.array(ProtocolSupplementSchema).max(50).default([]),
});

export type CreateProtocolInput = z.infer<typeof CreateProtocolSchema>;

export const UpdateProtocolSchema = CreateProtocolSchema.partial();

export type UpdateProtocolInput = z.infer<typeof UpdateProtocolSchema>;
