import {
  requireAuthenticatedUser,
  requireOwnResourceOrAdmin,
  toErrorResponse,
} from '@/lib/auth/authorization';
import { UpdateSupplementSchema } from '@/lib/validation/supplement.schemas';
import {
  getSupplementById,
  updateSupplement,
  deleteSupplement,
} from '@/modules/supplements/supplements.service';
import { logger } from '@/lib/logging/logger';

interface RouteParams {
  params: { id: string };
}

/**
 * Ownership is checked AFTER authentication but BEFORE any data is read or
 * mutated — this is the IDOR/BOLA choke point required by
 * ARCHITECTURE.md §10.6: an authenticated user requesting someone else's
 * supplement id gets exactly the same 404/403 shape as one requesting a
 * nonexistent id, and the update/delete below never runs.
 */
async function loadOwnedSupplement(id: string) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return { error: toErrorResponse(error) };
  }

  const supplement = await getSupplementById(id);
  if (!supplement) {
    return { error: Response.json({ error: 'Not found' }, { status: 404 }) };
  }

  try {
    await requireOwnResourceOrAdmin(supplement.userId);
  } catch (error) {
    return { error: toErrorResponse(error) };
  }

  return { supplement };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const result = await loadOwnedSupplement(params.id);
  if (result.error) return result.error;
  return Response.json(result.supplement, { status: 200 });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const result = await loadOwnedSupplement(params.id);
  if (result.error) return result.error;

  const body = await request.json().catch(() => null);
  const parsed = UpdateSupplementSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await updateSupplement(params.id, parsed.data);
    return Response.json(updated, { status: 200 });
  } catch (error) {
    logger.error('supplement_update_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to update supplement' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const result = await loadOwnedSupplement(params.id);
  if (result.error) return result.error;

  try {
    await deleteSupplement(params.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('supplement_delete_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to delete supplement' }, { status: 500 });
  }
}
