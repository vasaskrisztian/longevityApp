import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { CreateChallengeSchema } from '@/lib/validation/challenge.schemas';
import { listChallenges, createChallenge } from '@/modules/challenges/challenges.service';
import { logger } from '@/lib/logging/logger';

export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const challenges = await listChallenges(userId);
  return Response.json(challenges, { status: 200 });
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const challenge = await createChallenge(userId, parsed.data);
    return Response.json(challenge, { status: 201 });
  } catch (error) {
    logger.error('challenge_create_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to create challenge' }, { status: 500 });
  }
}
