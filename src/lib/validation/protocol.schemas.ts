import { z } from 'zod';
import { SupplementFrequencyEnum, SupplementTimingEnum } from './supplement.schemas';

// `z.coerce.number()` runs BEFORE `.optional()` is checked, and an empty
// text input submits `''`, which `Number('')` coerces to `0` — not
// `undefined` (see onboarding.schemas.ts's optionalCoercedInt for the same
// fix). Left unfixed here, every optional target/dosage field a user leaves
// blank would silently save as a real "0" target instead of staying unset —
// which is worse than onboarding's symptom (a visible "too small" error),
// since the dashboard would then show a fake "Target: 0" for every protocol
// that doesn't actually set that target.
const blankToUndefined = (val: unknown) =>
  val === '' || val === null || val === undefined ? undefined : val;

const optionalCoercedInt = (min: number, max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(min).max(max).optional());

const optionalCoercedPositiveNumber = (max: number) =>
  z.preprocess(
    blankToUndefined,
    z.coerce.number().positive('Dosage must be greater than 0').max(max).optional(),
  );

/**
 * One supplement target line inside a protocol. `id` is only ever present
 * on a row that already exists (an edit round-trip echoing it back) —
 * protocols.service.ts strips it before writing, since the whole list is
 * replaced wholesale on every save rather than diffed row-by-row.
 */
export const ProtocolSupplementSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  dosage: optionalCoercedPositiveNumber(1_000_000),
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
  targetSleepScore: optionalCoercedInt(0, 100),
  // Minutes, capped at 24h.
  targetSleepMinutes: optionalCoercedInt(0, 1440),
  targetWeeklyWorkouts: optionalCoercedInt(0, 50),
  targetDailyActiveCalories: optionalCoercedInt(0, 20_000),
  supplements: z.array(ProtocolSupplementSchema).max(50).default([]),
});

export type CreateProtocolInput = z.infer<typeof CreateProtocolSchema>;

export const UpdateProtocolSchema = CreateProtocolSchema.partial();

export type UpdateProtocolInput = z.infer<typeof UpdateProtocolSchema>;
