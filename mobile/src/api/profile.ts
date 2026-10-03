import { apiFetch, apiFetchJson } from '@/src/api/client';
import type {
  ExerciseProfileInput,
  NutritionProfileInput,
  PersonalInfoInput,
} from '@/src/validation/schemas';

/** Raw wire shapes — Profile.heightCm/weightKg are Prisma Decimal columns,
 * which Response.json() serializes via Decimal.js's toJSON() as a STRING,
 * not a number (confirmed against the web app's own personal-info-form.tsx
 * etc., which does the same `Number(...)` conversion after fetch). Dates
 * come back as full ISO datetime strings. */
interface RawProfile {
  fullName: string;
  birthDate: string;
  gender: string | null;
  heightCm: string;
  weightKg: string;
  timezone: string;
}

interface RawExerciseProfile {
  activityLevel: string;
  weeklyWorkoutCount: number | null;
  avgWorkoutDurationMin: number | null;
  activityTypes: string[];
  customActivities: string[];
}

interface RawNutritionProfile {
  dietType: string;
  dailyMealCount: number | null;
  dailyCaloriesKcal: number | null;
  dailyProteinGrams: number | null;
  allergies: string[];
  intolerances: string[];
  avoidedFoods: string[];
  notes: string | null;
}

interface RawProfileBundle {
  onboardingCompletedAt: string | null;
  profile: RawProfile | null;
  exerciseProfile: RawExerciseProfile | null;
  nutritionProfile: RawNutritionProfile | null;
}

export interface ProfileBundle {
  onboardingCompletedAt: string | null;
  profile: {
    fullName: string;
    /** Plain yyyy-mm-dd, ready for a text field. */
    birthDate: string;
    gender: string | null;
    heightCm: number;
    weightKg: number;
    timezone: string;
  } | null;
  exerciseProfile: RawExerciseProfile | null;
  nutritionProfile: RawNutritionProfile | null;
}

function toProfileBundle(raw: RawProfileBundle): ProfileBundle {
  return {
    onboardingCompletedAt: raw.onboardingCompletedAt,
    profile: raw.profile
      ? {
          fullName: raw.profile.fullName,
          birthDate: raw.profile.birthDate.slice(0, 10),
          gender: raw.profile.gender,
          heightCm: Number(raw.profile.heightCm),
          weightKg: Number(raw.profile.weightKg),
          timezone: raw.profile.timezone,
        }
      : null,
    exerciseProfile: raw.exerciseProfile,
    nutritionProfile: raw.nutritionProfile,
  };
}

/** GET /api/profile — onboardingCompletedAt doubles as the mobile onboarding
 * gate's source of truth (mirrors requireOnboardedUserForPage on the web). */
export async function getProfileBundle(): Promise<ProfileBundle> {
  const raw = await apiFetchJson<RawProfileBundle>('/api/profile');
  return toProfileBundle(raw);
}

/** PATCH /api/profile — birthDate goes over the wire as the plain yyyy-mm-dd
 * string the server's z.coerce.date() expects (same convention as the web
 * form's <input type="date">). */
export async function updatePersonalInfo(input: PersonalInfoInput): Promise<void> {
  const response = await apiFetch('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to save personal info (${response.status}).`);
  }
}

/** PATCH /api/profile/exercise */
export async function updateExerciseProfile(input: ExerciseProfileInput): Promise<void> {
  const response = await apiFetch('/api/profile/exercise', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to save exercise profile (${response.status}).`);
  }
}

/** PATCH /api/profile/nutrition */
export async function updateNutritionProfile(input: NutritionProfileInput): Promise<void> {
  const response = await apiFetch('/api/profile/nutrition', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to save nutrition profile (${response.status}).`);
  }
}
