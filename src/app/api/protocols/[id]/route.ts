import {
  requireAuthenticatedUser,
  requireOwnResourceOrAdmin,
  toErrorResponse,
} from '@/lib/auth/authorization';
import { UpdateProtocolSchema } from '@/lib/validation/protocol.schemas';
import { getProtocolById, updateProtocol, deleteProtocol } from '@/modules/protocols/protocols.service';
import { canPublishPublicly } from '@/modules/creators/creators.service';
import { logger } from '@/lib/logging/logger';

interface RouteParams {
  params: { id: string };
}

/** See src/app/api/supplements/[id]/route.ts's loadOwnedSupplement for why
 * ownership is re-verified here, per resource, before every read/write. */
async function loadOwnedProtocol(id: string) {
  try {
    await requireAuthenticatedUser();
  } catch (error) {
    return { error: toErrorResponse(error) };
  }

  const protocol = await getProtocolById(id);
  if (!protocol) {
    return { error: Response.json({ error: 'Not found' }, { status: 404 }) };
  }

  try {
    await requireOwnResourceOrAdmin(protocol.userId);
  } catch (error) {
    return { error: toErrorResponse(error) };
  }

  return { protocol };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const result = await loadOwnedProtocol(params.id);
  if (result.error) return result.error;
  return Response.json(result.protocol, { status: 200 });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const result = await loadOwnedProtocol(params.id);
  if (result.error) return result.error;

  const body = await request.json().catch(() => null);
  const parsed = UpdateProtocolSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // See POST /api/protocols — same CREATOR-only gate on PUBLIC.
  if (parsed.data.visibility === 'PUBLIC' && !(await canPublishPublicly(result.protocol!.userId))) {
    return Response.json(
      { error: 'Only a consenting creator account can publish a protocol publicly' },
      { status: 403 },
    );
  }

  try {
    // userId comes from the already-verified owner, not the request body —
    // needed so "set active" can demote this user's other protocols (see
    // protocols.service.ts's updateProtocol).
    const updated = await updateProtocol(params.id, result.protocol!.userId, parsed.data);
    return Response.json(updated, { status: 200 });
  } catch (error) {
    logger.error('protocol_update_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to update protocol' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const result = await loadOwnedProtocol(params.id);
  if (result.error) return result.error;

  try {
    await deleteProtocol(params.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    logger.error('protocol_delete_failed', { message: (error as Error).message });
    return Response.json({ error: 'Failed to delete protocol' }, { status: 500 });
  }
}
