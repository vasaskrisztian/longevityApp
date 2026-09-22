import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { CompleteOnboardingSchema } from '@/lib/validation/onboarding.schemas';
import { completeOnboarding } from '@/modules/profile/profile.service';
import { logger } from '@/lib/logging/logger';

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = CompleteOnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await completeOnboarding(userId, parsed.data);
  } catch (error) {
    logger.error('onboarding_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to complete onboarding' }, { status: 500 });
  }

  return Response.json({ message: 'Onboarding complete' }, { status: 200 });
}
