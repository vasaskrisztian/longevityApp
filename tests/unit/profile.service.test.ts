import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  profile: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  exerciseProfile: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  nutritionProfile: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  // completeOnboarding passes an array of already-invoked Prisma call
  // promises, matching real Prisma's `$transaction([...])` array form (see
  // auth.service.test.ts for the same convention).
  $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
};

vi.mock('@/lib/db/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const {
  getProfileBundle,
  isOnboardingComplete,
  updatePersonalInfo,
  upsertExerciseProfile,
  upsertNutritionProfile,
  completeOnboarding,
} = await import('@/modules/profile/profile.service');

const PERSONAL_INPUT = {
  fullName: 'Jane Doe',
  birthDate: new Date('1990-05-15'),
  gender: 'FEMALE' as const,
  heightCm: 170,
  weightKg: 65,
  timezone: 'Europe/Budapest',
};

const EXERCISE_INPUT = {
  activityLevel: 'MODERATELY_ACTIVE' as const,
  weeklyWorkoutCount: 4,
  avgWorkoutDurationMin: 45,
  activityTypes: ['RUNNING' as const],
  customActivities: ['bouldering'],
};

const NUTRITION_INPUT = {
  dietType: 'OMNIVORE' as const,
  dailyMealCount: 3,
  dailyCaloriesKcal: 2200,
  dailyProteinGrams: 120,
  allergies: ['peanuts'],
  intolerances: [] as string[],
  avoidedFoods: [] as string[],
  notes: 'No red meat',
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe('getProfileBundle', () => {
  it('combines user/profile/exercise/nutrition into one bundle', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ onboardingCompletedAt: new Date('2026-01-01') });
    prismaMock.profile.findUnique.mockResolvedValue({ fullName: 'Jane Doe' });
    prismaMock.exerciseProfile.findUnique.mockResolvedValue({ activityLevel: 'ATHLETE' });
    prismaMock.nutritionProfile.findUnique.mockResolvedValue(null);

    const bundle = await getProfileBundle('u1');

    expect(bundle.onboardingCompletedAt).toEqual(new Date('2026-01-01'));
    expect(bundle.profile).toEqual({ fullName: 'Jane Doe' });
    expect(bundle.exerciseProfile).toEqual({ activityLevel: 'ATHLETE' });
    expect(bundle.nutritionProfile).toBeNull();
  });

  it('returns onboardingCompletedAt: null when the user has none set', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ onboardingCompletedAt: null });
    prismaMock.profile.findUnique.mockResolvedValue(null);
    prismaMock.exerciseProfile.findUnique.mockResolvedValue(null);
    prismaMock.nutritionProfile.findUnique.mockResolvedValue(null);

    const bundle = await getProfileBundle('u1');
    expect(bundle.onboardingCompletedAt).toBeNull();
  });
});

describe('isOnboardingComplete', () => {
  it('returns true when onboardingCompletedAt is set', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ onboardingCompletedAt: new Date() });
    await expect(isOnboardingComplete('u1')).resolves.toBe(true);
  });

  it('returns false when onboardingCompletedAt is null', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ onboardingCompletedAt: null });
    await expect(isOnboardingComplete('u1')).resolves.toBe(false);
  });

  it('returns false when the user record is not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(isOnboardingComplete('u1')).resolves.toBe(false);
  });
});

describe('updatePersonalInfo', () => {
  it('updates the Profile row scoped by userId with the given fields', async () => {
    prismaMock.profile.update.mockResolvedValue({ id: 'p1', ...PERSONAL_INPUT });

    await updatePersonalInfo('u1', PERSONAL_INPUT);

    expect(prismaMock.profile.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: {
        fullName: PERSONAL_INPUT.fullName,
        birthDate: PERSONAL_INPUT.birthDate,
        gender: PERSONAL_INPUT.gender,
        heightCm: PERSONAL_INPUT.heightCm,
        weightKg: PERSONAL_INPUT.weightKg,
        timezone: PERSONAL_INPUT.timezone,
      },
    });
  });
});

describe('upsertExerciseProfile', () => {
  it('creates with userId when no row exists yet, updates otherwise', async () => {
    prismaMock.exerciseProfile.upsert.mockResolvedValue({ id: 'e1', ...EXERCISE_INPUT });

    await upsertExerciseProfile('u1', EXERCISE_INPUT);

    expect(prismaMock.exerciseProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      create: { userId: 'u1', ...EXERCISE_INPUT },
      update: { ...EXERCISE_INPUT },
    });
  });
});

describe('upsertNutritionProfile', () => {
  it('upserts the NutritionProfile row scoped by userId', async () => {
    prismaMock.nutritionProfile.upsert.mockResolvedValue({ id: 'n1', ...NUTRITION_INPUT });

    await upsertNutritionProfile('u1', NUTRITION_INPUT);

    expect(prismaMock.nutritionProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      create: { userId: 'u1', ...NUTRITION_INPUT },
      update: { ...NUTRITION_INPUT },
    });
  });
});

describe('completeOnboarding', () => {
  it('updates Profile, upserts Exercise/Nutrition, and stamps onboardingCompletedAt in one transaction', async () => {
    prismaMock.profile.update.mockResolvedValue({});
    prismaMock.exerciseProfile.upsert.mockResolvedValue({ id: 'e1' });
    prismaMock.nutritionProfile.upsert.mockResolvedValue({ id: 'n1' });
    prismaMock.user.update.mockResolvedValue({});

    const result = await completeOnboarding('u1', {
      personal: PERSONAL_INPUT,
      exercise: EXERCISE_INPUT,
      nutrition: NUTRITION_INPUT,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.profile.update).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: {
        fullName: PERSONAL_INPUT.fullName,
        birthDate: PERSONAL_INPUT.birthDate,
        gender: PERSONAL_INPUT.gender,
        heightCm: PERSONAL_INPUT.heightCm,
        weightKg: PERSONAL_INPUT.weightKg,
        timezone: PERSONAL_INPUT.timezone,
      },
    });
    expect(prismaMock.exerciseProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      create: { userId: 'u1', ...EXERCISE_INPUT },
      update: { ...EXERCISE_INPUT },
    });
    expect(prismaMock.nutritionProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      create: { userId: 'u1', ...NUTRITION_INPUT },
      update: { ...NUTRITION_INPUT },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { onboardingCompletedAt: expect.any(Date) },
    });
    expect(result).toEqual({ exerciseProfile: { id: 'e1' }, nutritionProfile: { id: 'n1' } });
  });
});
