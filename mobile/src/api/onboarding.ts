import { apiFetch } from '@/src/api/client';
import type {
  ExerciseProfileInput,
  NutritionProfileInput,
  PersonalInfoInput,
} from '@/src/validation/schemas';

export interface CompleteOnboardingInput {
  personal: PersonalInfoInput;
  exercise: ExerciseProfileInput;
  nutrition: NutritionProfileInput;
}

/** POST /api/onboarding — the one-shot combined submit at the end of the wizard. */
export async function completeOnboarding(input: CompleteOnboardingInput): Promise<void> {
  const response = await apiFetch('/api/onboarding', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to complete onboarding (${response.status}).`);
  }
}
