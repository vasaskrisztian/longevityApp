import { apiFetchJson } from '@/src/api/client';

/** Mirrors modules/profile/profile.service.ts's getProfileBundle return shape
 * (only the fields the Dashboard greeting needs — onboarding/exercise/
 * nutrition profile details are out of scope until phase 18's Profile screens). */
export interface ProfileBundle {
  onboardingCompletedAt: string | null;
  profile: { fullName: string | null } | null;
}

/** GET /api/profile */
export function getProfileBundle(): Promise<ProfileBundle> {
  return apiFetchJson<ProfileBundle>('/api/profile');
}
