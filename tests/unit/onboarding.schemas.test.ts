import { describe, it, expect } from 'vitest';
import {
  PersonalInfoSchema,
  ExerciseProfileSchema,
  NutritionProfileSchema,
  CompleteOnboardingSchema,
} from '@/lib/validation/onboarding.schemas';

const VALID_PERSONAL = {
  fullName: 'Jane Doe',
  birthDate: '1990-05-15',
  gender: 'FEMALE',
  heightCm: 170,
  weightKg: 65,
  timezone: 'Europe/Budapest',
};

const VALID_EXERCISE = {
  activityLevel: 'MODERATELY_ACTIVE',
  weeklyWorkoutCount: 4,
  avgWorkoutDurationMin: 45,
  activityTypes: ['RUNNING', 'YOGA'],
  customActivities: ['bouldering'],
};

const VALID_NUTRITION = {
  dietType: 'OMNIVORE',
  dailyMealCount: 3,
  dailyCaloriesKcal: 2200,
  dailyProteinGrams: 120,
  allergies: ['peanuts'],
  intolerances: [],
  avoidedFoods: [],
  notes: 'No red meat',
};

describe('PersonalInfoSchema', () => {
  it('accepts a fully valid personal info payload', () => {
    const result = PersonalInfoSchema.safeParse(VALID_PERSONAL);
    expect(result.success).toBe(true);
  });

  it('accepts a payload without the optional gender field', () => {
    const { gender: _gender, ...rest } = VALID_PERSONAL;
    expect(PersonalInfoSchema.safeParse(rest).success).toBe(true);
  });

  it('rejects an empty full name', () => {
    const result = PersonalInfoSchema.safeParse({ ...VALID_PERSONAL, fullName: '  ' });
    expect(result.success).toBe(false);
  });

  it('rejects a birth date implying an age under 13', () => {
    const tooYoung = new Date();
    tooYoung.setFullYear(tooYoung.getFullYear() - 5);
    const result = PersonalInfoSchema.safeParse({
      ...VALID_PERSONAL,
      birthDate: tooYoung.toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a birth date older than 120 years', () => {
    const result = PersonalInfoSchema.safeParse({ ...VALID_PERSONAL, birthDate: '1850-01-01' });
    expect(result.success).toBe(false);
  });

  it('rejects a height outside the plausible human range', () => {
    expect(PersonalInfoSchema.safeParse({ ...VALID_PERSONAL, heightCm: 10 }).success).toBe(false);
    expect(PersonalInfoSchema.safeParse({ ...VALID_PERSONAL, heightCm: 500 }).success).toBe(false);
  });

  it('rejects a weight outside the plausible human range', () => {
    expect(PersonalInfoSchema.safeParse({ ...VALID_PERSONAL, weightKg: 1 }).success).toBe(false);
    expect(PersonalInfoSchema.safeParse({ ...VALID_PERSONAL, weightKg: 1000 }).success).toBe(
      false,
    );
  });

  it('rejects a missing timezone', () => {
    const result = PersonalInfoSchema.safeParse({ ...VALID_PERSONAL, timezone: '' });
    expect(result.success).toBe(false);
  });

  it('coerces numeric string height/weight (native <input type="number"> values)', () => {
    const result = PersonalInfoSchema.safeParse({
      ...VALID_PERSONAL,
      heightCm: '170',
      weightKg: '65',
    });
    expect(result.success).toBe(true);
  });
});

describe('ExerciseProfileSchema', () => {
  it('accepts a fully valid exercise profile payload', () => {
    expect(ExerciseProfileSchema.safeParse(VALID_EXERCISE).success).toBe(true);
  });

  it('defaults activityTypes/customActivities to empty arrays when omitted', () => {
    const { activityTypes: _a, customActivities: _c, ...rest } = VALID_EXERCISE;
    const result = ExerciseProfileSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activityTypes).toEqual([]);
      expect(result.data.customActivities).toEqual([]);
    }
  });

  it('rejects an invalid activityLevel enum value', () => {
    const result = ExerciseProfileSchema.safeParse({ ...VALID_EXERCISE, activityLevel: 'LAZY' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid activityTypes enum member', () => {
    const result = ExerciseProfileSchema.safeParse({
      ...VALID_EXERCISE,
      activityTypes: ['SKATEBOARDING'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative weeklyWorkoutCount', () => {
    const result = ExerciseProfileSchema.safeParse({ ...VALID_EXERCISE, weeklyWorkoutCount: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects more than 28 weekly workouts', () => {
    const result = ExerciseProfileSchema.safeParse({ ...VALID_EXERCISE, weeklyWorkoutCount: 29 });
    expect(result.success).toBe(false);
  });
});

describe('NutritionProfileSchema', () => {
  it('accepts a fully valid nutrition profile payload', () => {
    expect(NutritionProfileSchema.safeParse(VALID_NUTRITION).success).toBe(true);
  });

  it('rejects an invalid dietType enum value', () => {
    const result = NutritionProfileSchema.safeParse({ ...VALID_NUTRITION, dietType: 'CARNIVORE' });
    expect(result.success).toBe(false);
  });

  it('rejects an implausibly low daily calorie count', () => {
    const result = NutritionProfileSchema.safeParse({
      ...VALID_NUTRITION,
      dailyCaloriesKcal: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects notes longer than 1000 characters', () => {
    const result = NutritionProfileSchema.safeParse({
      ...VALID_NUTRITION,
      notes: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts a payload with no allergies/intolerances/avoidedFoods (default empty arrays)', () => {
    const { allergies: _a, intolerances: _i, avoidedFoods: _f, ...rest } = VALID_NUTRITION;
    const result = NutritionProfileSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allergies).toEqual([]);
    }
  });
});

describe('CompleteOnboardingSchema', () => {
  it('accepts a valid combined payload of all three sections', () => {
    const result = CompleteOnboardingSchema.safeParse({
      personal: VALID_PERSONAL,
      exercise: VALID_EXERCISE,
      nutrition: VALID_NUTRITION,
    });
    expect(result.success).toBe(true);
  });

  it('rejects when any one section is invalid', () => {
    const result = CompleteOnboardingSchema.safeParse({
      personal: { ...VALID_PERSONAL, fullName: '' },
      exercise: VALID_EXERCISE,
      nutrition: VALID_NUTRITION,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing an entire section', () => {
    const result = CompleteOnboardingSchema.safeParse({
      personal: VALID_PERSONAL,
      exercise: VALID_EXERCISE,
    });
    expect(result.success).toBe(false);
  });
});
