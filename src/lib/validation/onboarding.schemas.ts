import { z } from 'zod';

// Mirrors Profile / ExerciseProfile / NutritionProfile in prisma/schema.prisma.
// Used both for the onboarding wizard (all three combined) and for the
// per-section edit forms under /profile once onboarding is complete.

const GENDER_VALUES = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const;
const ACTIVITY_LEVEL_VALUES = [
  'SEDENTARY',
  'LIGHTLY_ACTIVE',
  'MODERATELY_ACTIVE',
  'VERY_ACTIVE',
  'ATHLETE',
] as const;
const ACTIVITY_TYPE_VALUES = [
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
] as const;
const DIET_TYPE_VALUES = [
  'OMNIVORE',
  'VEGETARIAN',
  'VEGAN',
  'PESCATARIAN',
  'KETOGENIC',
  'LOW_CARB',
  'MEDITERRANEAN',
  'OTHER',
] as const;

// `z.coerce.number()` runs BEFORE `.optional()` is checked, and an empty
// text input submits `''`, which `Number('')` coerces to `0` — not
// `undefined`. For a field whose minimum is above 0 (dailyMealCount,
// dailyCaloriesKcal) that made leaving it blank fail validation as "too
// small" instead of being treated as not provided, so an "(optional)" field
// was effectively required. This preprocesses blank/null/undefined to
// `undefined` first, so `.optional()` actually applies.
const optionalCoercedInt = (min: number, max: number) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.number().int().min(min).max(max).optional(),
  );

export const GenderEnum = z.enum(GENDER_VALUES);
export const ActivityLevelEnum = z.enum(ACTIVITY_LEVEL_VALUES);
export const ActivityTypeEnum = z.enum(ACTIVITY_TYPE_VALUES);
export const DietTypeEnum = z.enum(DIET_TYPE_VALUES);

// Oldest a user can plausibly be (120y) and youngest allowed (13y, matches
// the ARCHITECTURE.md minimum-age assumption pending a real ToS gate).
const MIN_BIRTH_DATE = new Date(Date.now() - 120 * 365.25 * 24 * 60 * 60 * 1000);
const MAX_BIRTH_DATE = new Date(Date.now() - 13 * 365.25 * 24 * 60 * 60 * 1000);

export const PersonalInfoSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(200),
  birthDate: z.coerce
    .date()
    .min(MIN_BIRTH_DATE, 'Please enter a valid birth date')
    .max(MAX_BIRTH_DATE, 'You must be at least 13 years old'),
  gender: GenderEnum.optional(),
  heightCm: z.coerce.number().min(50, 'Height must be at least 50cm').max(272, 'Height must be at most 272cm'),
  weightKg: z.coerce.number().min(20, 'Weight must be at least 20kg').max(400, 'Weight must be at most 400kg'),
  timezone: z.string().trim().min(1, 'Timezone is required').max(100),
});

export type PersonalInfoInput = z.infer<typeof PersonalInfoSchema>;

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

export const CompleteOnboardingSchema = z.object({
  personal: PersonalInfoSchema,
  exercise: ExerciseProfileSchema,
  nutrition: NutritionProfileSchema,
});

export type CompleteOnboardingInput = z.infer<typeof CompleteOnboardingSchema>;
