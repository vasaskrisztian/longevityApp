import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { AdminUserListQuerySchema } from '@/lib/validation/admin.schemas';
import { listUsersForAdmin } from '@/modules/admin/admin.service';

/** ARCHITECTURE.md §8.2: "List all users, search, filter by Oura status" — read-only, not individually audited. */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    return toErrorResponse(error);
  }

  const url = new URL(request.url);
  const parsed = AdminUserListQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined,
    ouraStatus: url.searchParams.get('ouraStatus') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await listUsersForAdmin(parsed.data);
  return Response.json(result, { status: 200 });
}
