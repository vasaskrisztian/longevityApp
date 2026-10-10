import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { UpdateGroupSchema } from '@/lib/validation/group.schemas';
import { deleteGroup, getGroupDetailForAdmin, updateGroup } from '@/modules/groups/groups.service';
import { InvalidLogoError } from '@/modules/groups/group-logo';

interface RouteParams {
  params: { id: string };
}

/** The group with its members (consented) and open / lapsed invitations. */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
  } catch (error) {
    return toErrorResponse(error);
  }
  const detail = await getGroupDetailForAdmin(params.id);
  if (!detail) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(detail, { status: 200 });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await updateGroup(adminId, params.id, parsed.data);
    if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof InvalidLogoError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  const deleted = await deleteGroup(adminId, params.id);
  if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 });
  return new Response(null, { status: 204 });
}
