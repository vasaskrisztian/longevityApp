import { z } from 'zod';

/**
 * Mirrors lib/validation/onboarding.schemas.ts, goal.schemas.ts and
 * supplement.schemas.ts on the root app — mobile/ is its own independent
 * npm project (claude/phase-15-mobile-migration-plan.md) with no path back
 * to the root app's src/lib, so these are hand-duplicated rather than
 * imported, same pattern app/login.tsx already established for
 * LoginFormSchema. The server re-validates with the real schema regardless
 * (these are client-side UX only — catching an obvious mistake before a
 * round trip, not the security boundary), so drift here is a UX nit, never
 * a security issue.
 */

export const GenderEnum = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);
export const ActivityLevelEnum = z.enum([
  'SEDENTARY',
  'LIGHTLY_ACTIVE',
  'MODERATELY_ACTIVE',
  'VERY_ACTIVE',
  'ATHLETE',
]);
export const ActivityTypeEnum = z.enum([
  'STRENGTH_TRAINING',
  'WALKING',
  'RUNNING',
  'CYCLING',
  'SWIMMING',
  'YOGA',
  'PILATES',
  'HIIT',
  'CROSSFIT',
  'TEAM_SPORTS',
  'OTHER',
]);
export const DietTypeEnum = z.enum([
  'OMNIVORE',
  'VEGETARIAN',
  'VEGAN',
  'PESCATARIAN',
  'KETOGENIC',
  'LOW_CARB',
  'MEDITERRANEAN',
  'OTHER',
]);
export const GoalTypeEnum = z.enum([
  'SLEEP_IMPROVEMENT',
  'STRESS_REDUCTION',
  'WEIGHT_LOSS',
  'WEIGHT_GAIN',
  'MUSCLE_GAIN',
  'RECOVERY',
  'CARDIOVASCULAR_FITNESS',
  'GENERAL_HEALTH',
  'ENERGY',
  'PERFORMANCE',
  'OTHER',
]);
export const GoalStatusEnum = z.enum(['ACTIVE', 'ACHIEVED', 'PAUSED', 'ABANDONED']);
export const SupplementFrequencyEnum = z.enum([
  'DAILY',
  'TWICE_DAILY',
  'THREE_TIMES_DAILY',
  'WEEKLY',
  'AS_NEEDED',
  'OTHER',
]);
export const SupplementTimingEnum = z.enum([
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'BEFORE_MEAL',
  'AFTER_MEAL',
  'BEFORE_SLEEP',
  'BEFORE_WORKOUT',
  'AFTER_WORKOUT',
  'OTHER',
]);

// Plain "yyyy-mm-dd" text field (no native date picker — see
// claude/phase-15-mobile-migration-plan.md's phase 18 notes for why), kept
// loose here and left for the server's z.coerce.date() to actually
// validate; this only catches an empty birth date before a round trip.
const dateString = z.string().trim().min(1, 'Required (yyyy-mm-dd)');

export const PersonalInfoSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(200),
  birthDate: dateString,
  gender: GenderEnum.optional(),
  heightCm: z.coerce.number().min(50, 'Must be at least 50cm').max(272, 'Must be at most 272cm'),
  weightKg: z.coerce.number().min(20, 'Must be at least 20kg').max(400, 'Must be at most 400kg'),
  timezone: z.string().trim().min(1, 'Timezone is required').max(100),
});
export type PersonalInfoInput = z.infer<typeof PersonalInfoSchema>;

const optionalCoercedInt = (min: number, max: number) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.number().int().min(min).max(max).optional(),
  );

export const ExerciseProfileSchema = z.object({
  activityLevel: ActivityLevelEnum,
  weeklyWorkoutCount: optionalCoercedInt(0, 28),
  avgWorkoutDurationMin: optionalCoercedInt(0, 600),
  activityTypes: z.array(ActivityTypeEnum).default([]),
  customActivities: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});
export type ExerciseProfileInput = z.infer<typeof ExerciseProfileSchema>;

export const NutritionProfileSchema = z.object({
  dietType: DietTypeEnum,
  dailyMealCount: optionalCoercedInt(1, 10),
  dailyCaloriesKcal: optionalCoercedInt(500, 10000),
  dailyProteinGrams: optionalCoercedInt(0, 500),
  allergies: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  intolerances: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  avoidedFoods: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  notes: z.string().trim().max(1000).optional(),
});
export type NutritionProfileInput = z.infer<typeof NutritionProfileSchema>;

export const CreateGoalSchema = z.object({
  type: GoalTypeEnum,
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(1000).optional(),
  targetValue: z.coerce.number().max(1_000_000_000).optional(),
  targetUnit: z.string().trim().max(20).optional(),
  targetDate: z.string().trim().optional(),
  status: GoalStatusEnum.default('ACTIVE'),
});
export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;

export const CreateSupplementSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  dosage: z.coerce.number().positive('Must be greater than 0').max(1_000_000),
  unit: z.string().trim().min(1, 'Unit is required').max(20),
  frequency: SupplementFrequencyEnum,
  timing: SupplementTimingEnum.optional(),
  notes: z.string().trim().max(1000).optional(),
  active: z.boolean().default(true),
});
export type CreateSupplementInput = z.infer<typeof CreateSupplementSchema>;

// Phase 20 — mirrors lib/validation/visibility.schemas.ts/protocol.schemas.ts/
// challenge.schemas.ts on the root app. Same hand-duplication precedent as
// every schema above (mobile/ has no path back to src/lib); the server
// remains the real validation boundary (and the real PUBLIC-visibility gate
// — see src/app/api/protocols/route.ts's canPublishPublicly check) in every
// case.
export const VisibilityEnum = z.enum(['PRIVATE', 'PUBLIC']);

// Blank numeric text inputs submit '' , which z.coerce.number() turns into 0
// rather than leaving unset — same fix as the onboarding/goal schemas'
// optionalCoercedInt above, needed again here for the optional protocol
// targets and supplement dosage.
const blankToUndefined = (val: unknown) => (val === '' || val === null || val === undefined ? undefined : val);

const optionalCoercedPositiveNumber = (max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().positive('Dosage must be greater than 0').max(max).optional());

export const ProtocolSupplementSchema = z.object({
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
  // 0-100 Oura-style score.
  targetSleepScore: optionalCoercedInt(0, 100),
  // Minutes, capped at 24h.
  targetSleepMinutes: optionalCoercedInt(0, 1440),
  targetWeeklyWorkouts: optionalCoercedInt(0, 50),
  targetDailyActiveCalories: optionalCoercedInt(0, 20_000),
  supplements: z.array(ProtocolSupplementSchema).max(50).default([]),
});
export type CreateProtocolInput = z.infer<typeof CreateProtocolSchema>;

export const ChallengeTypeEnum = z.enum(['SLEEP_SCORE', 'DAILY_STEPS', 'WEEKLY_WORKOUTS']);

// requiredCount/threshold/windowDays are required (min 1), not optional —
// same reasoning as the root app's challenge.schemas.ts: a challenge
// without terms isn't a challenge, and leaving these optional would let a
// blank field silently coerce to a real (wrong) 0 instead of failing
// validation.
export const CreateChallengeSchema = z.object({
  type: ChallengeTypeEnum,
  name: z.string().trim().max(200).optional(),
  requiredCount: z.coerce.number().int().min(1, 'Must be at least 1').max(1000),
  threshold: z.coerce.number().int().min(1, 'Must be at least 1').max(100_000),
  windowDays: z.coerce.number().int().min(1, 'Must be at least 1 day').max(365),
});
export type CreateChallengeInput = z.infer<typeof CreateChallengeSchema>;

/** "STRENGTH_TRAINING" -> "Strength training" — every enum above renders this way. */
export function enumLabel(value: string): string {
  const lower = value.replaceAll('_', ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
