import { z } from 'zod';
import { VisibilityEnum } from './visibility.schemas';

// The three metrics a challenge can be defined against — kept in sync with
// the ChallengeType enum in schema.prisma.
export const ChallengeTypeEnum = z.enum(['SLEEP_SCORE', 'DAILY_STEPS', 'WEEKLY_WORKOUTS']);
export type ChallengeTypeInput = z.infer<typeof ChallengeTypeEnum>;

// Unlike Protocol's target fields, requiredCount/threshold/windowDays are
// all REQUIRED here (min 1), not `.optional()` — a challenge without terms
// isn't a challenge. That side-steps the blank-input-coerces-to-0 bug class
// fixed in protocol.schemas.ts (blankToUndefined): a blank field here fails
// min(1) with a visible "too small" error instead of silently saving as a
// real 0, which would be actively wrong (e.g. a "steps > 0" challenge that
// completes after a single day).
export const CreateChallengeSchema = z.object({
  type: ChallengeTypeEnum,
  // Optional custom label; the UI derives a readable description from the
  // fields below when this is left blank.
  name: z.string().trim().max(200).optional(),
  // "X times" — nights/days/weeks depending on `type`.
  requiredCount: z.coerce.number().int().min(1, 'Must be at least 1').max(1000),
  // "above Y" — sleep score points / steps / workouts-per-week depending on `type`.
  threshold: z.coerce.number().int().min(1, 'Must be at least 1').max(100_000),
  // "within Z days" — the challenge's total length once activated.
  windowDays: z.coerce.number().int().min(1, 'Must be at least 1 day').max(365),
  // Optional, not `.default()` — see protocol.schemas.ts's identical field
  // for why (keeps z.infer's output type from forcing every form-values
  // object to set it; Prisma's own column default fills it in when absent).
  visibility: VisibilityEnum.optional(),
});

export type CreateChallengeInput = z.infer<typeof CreateChallengeSchema>;

// Only ever applied to a still-DRAFT challenge (activatedAt is null) — see
// the [id] route, which rejects an edit once activatedAt is set. Changing a
// challenge's terms mid-run would defeat the point of committing to it.
export const UpdateChallengeSchema = CreateChallengeSchema.partial();

export type UpdateChallengeInput = z.infer<typeof UpdateChallengeSchema>;
