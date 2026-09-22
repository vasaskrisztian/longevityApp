import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { CreateGoalSchema } from '@/lib/validation/goal.schemas';
import { listGoals, createGoal } from '@/modules/goals/goals.service';
import { logger } from '@/lib/logging/logger';

export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const goals = await listGoals(userId);
  return Response.json(goals, { status: 200 });
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateGoalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const goal = await createGoal(userId, parsed.data);
    return Response.json(goal, { status: 201 });
  } catch (error) {
    logger.error('goal_create_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}
