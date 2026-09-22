import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { NutritionProfileSchema } from '@/lib/validation/onboarding.schemas';
import { upsertNutritionProfile } from '@/modules/profile/profile.service';
import { logger } from '@/lib/logging/logger';

export async function PATCH(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = NutritionProfileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const nutritionProfile = await upsertNutritionProfile(userId, parsed.data);
    return Response.json(nutritionProfile, { status: 200 });
  } catch (error) {
    logger.error('nutrition_profile_update_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to update nutrition profile' }, { status: 500 });
  }
}
