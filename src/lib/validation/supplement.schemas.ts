import { z } from 'zod';

const FREQUENCY_VALUES = [
  'DAILY',
  'TWICE_DAILY',
  'THREE_TIMES_DAILY',
  'WEEKLY',
  'AS_NEEDED',
  'OTHER',
] as const;
const TIMING_VALUES = [
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'BEFORE_MEAL',
  'AFTER_MEAL',
  'BEFORE_SLEEP',
  'BEFORE_WORKOUT',
  'AFTER_WORKOUT',
  'OTHER',
] as const;

export const SupplementFrequencyEnum = z.enum(FREQUENCY_VALUES);
export const SupplementTimingEnum = z.enum(TIMING_VALUES);

export const CreateSupplementSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  dosage: z.coerce.number().positive('Dosage must be greater than 0').max(1_000_000),
  unit: z.string().trim().min(1, 'Unit is required').max(20),
  frequency: SupplementFrequencyEnum,
  timing: SupplementTimingEnum.optional(),
  notes: z.string().trim().max(1000).optional(),
  active: z.boolean().default(true),
});

export type CreateSupplementInput = z.infer<typeof CreateSupplementSchema>;

export const UpdateSupplementSchema = CreateSupplementSchema.partial();

export type UpdateSupplementInput = z.infer<typeof UpdateSupplementSchema>;
