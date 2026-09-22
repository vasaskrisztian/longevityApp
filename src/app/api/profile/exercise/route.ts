import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { ExerciseProfileSchema } from '@/lib/validation/onboarding.schemas';
import { upsertExerciseProfile } from '@/modules/profile/profile.service';
import { logger } from '@/lib/logging/logger';

export async function PATCH(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = ExerciseProfileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const exerciseProfile = await upsertExerciseProfile(userId, parsed.data);
    return Response.json(exerciseProfile, { status: 200 });
  } catch (error) {
    logger.error('exercise_profile_update_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to update exercise profile' }, { status: 500 });
  }
}
