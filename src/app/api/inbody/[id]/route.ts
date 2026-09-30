import {
  requireAuthenticatedUser,
  requireOwnResourceOrAdmin,
  toErrorResponse,
} from '@/lib/auth/authorization';
import { UpdateInBodyMeasurementSchema } from '@/lib/validation/inbody.schemas';
import {
  getInBodyMeasurementById,
  updateInBodyMeasurement,
  deleteInBodyMeasurement,
} from '@/modules/inbody/inbody.service';
import { toInBodyMeasurementDTO } from '../dto';
import { logger } from '@/lib/logging/logger';

interface RouteParams {
  params: { id: string };
}

/**
 * Same IDOR/BOLA choke point as supplements/[id]/route.ts and
 * goals/[id]/route.ts: ownership is checked AFTER authentication but
 * BEFORE any data is read or mutated.
 */
async function loadOwnedMeasurement(id: string) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return { error: toErrorResponse(error) };
  }

  const measurement = await getInBodyMeasurementById(id);
  if (!measurement) {
    return { error: Response.json({ error: 'Not found' }, { status: 404 }) };
  }

  try {
    await requireOwnResourceOrAdmin(measurement.userId);
  } catch (error) {
    return { error: toErrorResponse(error) };
  }

  return { measurement };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const result = await loadOwnedMeasurement(params.id);
  if (result.error) return result.error;
  return Response.json(toInBodyMeasurementDTO(result.measurement), { status: 200 });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const result = await loadOwnedMeasurement(params.id);
  if (result.error) return result.error;

  const body = await request.json().catch(() => null);
  const parsed = UpdateInBodyMeasurementSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await updateInBodyMeasurement(params.id, parsed.data);
    return Response.json(toInBodyMeasurementDTO(updated), { status: 200 });
  } catch (error) {
    logger.error('inbody_update_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const result = await loadOwnedMeasurement(params.id);
  if (result.error) return result.error;

  try {
    await deleteInBodyMeasurement(params.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('inbody_delete_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
