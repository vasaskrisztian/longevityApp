import {
  requireAuthenticatedUser,
  requireOwnResourceOrAdmin,
  toErrorResponse,
} from '@/lib/auth/authorization';
import { UpdateGoalSchema } from '@/lib/validation/goal.schemas';
import { getGoalById, updateGoal, deleteGoal } from '@/modules/goals/goals.service';
import { logger } from '@/lib/logging/logger';

interface RouteParams {
  params: { id: string };
}

/** See src/app/api/supplements/[id]/route.ts's loadOwnedSupplement for why
 * ownership is re-verified here, per resource, before every read/write. */
async function loadOwnedGoal(id: string) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return { error: toErrorResponse(error) };
  }

  const goal = await getGoalById(id);
  if (!goal) {
    return { error: Response.json({ error: 'Not found' }, { status: 404 }) };
  }

  try {
    await requireOwnResourceOrAdmin(goal.userId);
  } catch (error) {
    return { error: toErrorResponse(error) };
  }

  return { goal };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const result = await loadOwnedGoal(params.id);
  if (result.error) return result.error;
  return Response.json(result.goal, { status: 200 });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const result = await loadOwnedGoal(params.id);
  if (result.error) return result.error;

  const body = await request.json().catch(() => null);
  const parsed = UpdateGoalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await updateGoal(params.id, parsed.data);
    return Response.json(updated, { status: 200 });
  } catch (error) {
    logger.error('goal_update_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const result = await loadOwnedGoal(params.id);
  if (result.error) return result.error;

  try {
    await deleteGoal(params.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('goal_delete_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}
