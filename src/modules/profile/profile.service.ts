import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logging/logger';
import type {
  PersonalInfoInput,
  ExerciseProfileInput,
  NutritionProfileInput,
  CompleteOnboardingInput,
} from '@/lib/validation/onboarding.schemas';

/**
 * Everything the onboarding wizard and the /profile edit pages need in one
 * shot. exerciseProfile/nutritionProfile are null until onboarding (or a
 * later edit) creates them — every field the UI reads must therefore treat
 * them as optional.
 */
export async function getProfileBundle(userId: string) {
  const [user, profile, exerciseProfile, nutritionProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompletedAt: true },
    }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.exerciseProfile.findUnique({ where: { userId } }),
    prisma.nutritionProfile.findUnique({ where: { userId } }),
  ]);

  return {
    onboardingCompletedAt: user?.onboardingCompletedAt ?? null,
    profile,
    exerciseProfile,
    nutritionProfile,
  };
}

export async function isOnboardingComplete(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingCompletedAt: true },
  });
  return Boolean(user?.onboardingCompletedAt);
}

export async function updatePersonalInfo(userId: string, input: PersonalInfoInput) {
  return prisma.profile.update({
    where: { userId },
    data: {
      fullName: input.fullName,
      birthDate: input.birthDate,
      gender: input.gender,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      timezone: input.timezone,
    },
  });
}

export async function upsertExerciseProfile(userId: string, input: ExerciseProfileInput) {
  return prisma.exerciseProfile.upsert({
    where: { userId },
    create: { userId, ...input },
    update: { ...input },
  });
}

export async function upsertNutritionProfile(userId: string, input: NutritionProfileInput) {
  return prisma.nutritionProfile.upsert({
    where: { userId },
    create: { userId, ...input },
    update: { ...input },
  });
}

/**
 * Runs the full wizard submission as a single transaction: the Profile row
 * already exists (created at registration with placeholder values — see
 * auth.service.ts's registerUser), so this is an update, while
 * ExerciseProfile/NutritionProfile are created here for the first time via
 * upsert (safe to call again later from the per-section edit forms).
 * Setting onboardingCompletedAt in the same transaction is what makes
 * requireOnboardedUserForPage() let the user through afterwards.
 */
export async function completeOnboarding(userId: string, input: CompleteOnboardingInput) {
  const [, exerciseProfile, nutritionProfile] = await prisma.$transaction([
    prisma.profile.update({
      where: { userId },
      data: {
        fullName: input.personal.fullName,
        birthDate: input.personal.birthDate,
        gender: input.personal.gender,
        heightCm: input.personal.heightCm,
        weightKg: input.personal.weightKg,
        timezone: input.personal.timezone,
      },
    }),
    prisma.exerciseProfile.upsert({
      where: { userId },
      create: { userId, ...input.exercise },
      update: { ...input.exercise },
    }),
    prisma.nutritionProfile.upsert({
      where: { userId },
      create: { userId, ...input.nutrition },
      update: { ...input.nutrition },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: new Date() },
    }),
  ]);

  logger.info('onboarding_completed', { userId });
  return { exerciseProfile, nutritionProfile };
}
