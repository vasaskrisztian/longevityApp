import {
  requireAuthenticatedUser,
  requireOwnResourceOrAdmin,
  toErrorResponse,
} from '@/lib/auth/authorization';
import { UpdateChallengeSchema } from '@/lib/validation/challenge.schemas';
import {
  getChallengeById,
  updateChallenge,
  activateChallenge,
  deleteChallenge,
} from '@/modules/challenges/challenges.service';
import { logger } from '@/lib/logging/logger';

interface RouteParams {
  params: { id: string };
}

/** See src/app/api/supplements/[id]/route.ts's loadOwnedSupplement for why
 * ownership is re-verified here, per resource, before every read/write. */
async function loadOwnedChallenge(id: string) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return { error: toErrorResponse(error) };
  }

  const challenge = await getChallengeById(id);
  if (!challenge) {
    return { error: Response.json({ error: 'Not found' }, { status: 404 }) };
  }

  try {
    await requireOwnResourceOrAdmin(challenge.userId);
  } catch (error) {
    return { error: toErrorResponse(error) };
  }

  return { challenge };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const result = await loadOwnedChallenge(params.id);
  if (result.error) return result.error;
  return Response.json(result.challenge, { status: 200 });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const result = await loadOwnedChallenge(params.id);
  if (result.error) return result.error;
  const challenge = result.challenge!;

  const body = await request.json().catch(() => null);

  // `{ activate: true }` starts the challenge (sets activatedAt/expiresAt) —
  // a distinct action from editing its terms, so it's checked first and
  // never runs through the field-update schema below.
  if (body && (body as { activate?: unknown }).activate === true) {
    if (challenge.activatedAt) {
      return Response.json({ error: 'Challenge is already active' }, { status: 409 });
    }
    try {
      const activated = await activateChallenge(params.id, challenge.windowDays);
      return Response.json(activated, { status: 200 });
    } catch (error) {
      logger.error('challenge_activate_failed', { message: (error as Error).message });
      return Response.json({ error: 'Failed to activate challenge' }, { status: 500 });
    }
  }

  // Once activated, a challenge's terms are read-only — changing them
  // mid-run would defeat the point of committing to it (see
  // challenges.service.ts's updateChallenge doc comment).
  if (challenge.activatedAt) {
    return Response.json({ error: 'Cannot edit an active challenge' }, { status: 409 });
  }

  const parsed = UpdateChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await updateChallenge(params.id, parsed.data);
    return Response.json(updated, { status: 200 });
  } catch (error) {
    logger.error('challenge_update_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to update challenge' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const result = await loadOwnedChallenge(params.id);
  if (result.error) return result.error;

  try {
    await deleteChallenge(params.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('challenge_delete_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to delete challenge' }, { status: 500 });
  }
}
