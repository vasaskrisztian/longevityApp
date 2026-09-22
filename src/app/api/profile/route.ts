import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { PersonalInfoSchema } from '@/lib/validation/onboarding.schemas';
import { getProfileBundle, updatePersonalInfo } from '@/modules/profile/profile.service';
import { logger } from '@/lib/logging/logger';

export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const bundle = await getProfileBundle(userId);
  return Response.json(bundle, { status: 200 });
}

export async function PATCH(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = PersonalInfoSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const profile = await updatePersonalInfo(userId, parsed.data);
    return Response.json(profile, { status: 200 });
  } catch (error) {
    logger.error('profile_update_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
