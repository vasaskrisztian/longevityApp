import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { getUserDetailForAdmin, recordAdminViewUser } from '@/modules/admin/admin.service';

interface RouteParams {
  params: { id: string };
}

/**
 * ARCHITECTURE.md §8.2: "Open a user's full dashboard" -> `ADMIN_VIEW_USER`.
 * This is the endpoint §10.6's IDOR/BOLA example targets (a non-admin gets
 * 403 before the target user is even looked up; an admin gets 200 and an
 * audit row). A nonexistent target id 404s — the same shape whether the id
 * never existed or the caller lacked access, since a 401/403 is returned
 * first in the latter case anyway.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const detail = await getUserDetailForAdmin(params.id);
  if (!detail) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  await recordAdminViewUser(adminId, params.id);

  return Response.json(detail, { status: 200 });
}
