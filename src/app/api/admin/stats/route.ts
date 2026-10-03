import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { getAdminStats } from '@/modules/admin/admin.service';

/**
 * Phase 22 (mobile admin) — new, additive route. The web admin dashboard's
 * 4 KPI tiles (`admin/page.tsx`) were only ever computed inline in that
 * server component; mobile has no server components, so it needs this
 * thin GET wrapper around the same counts. Read-only, not individually
 * audited — same precedent as `GET /api/admin/users`.
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    return toErrorResponse(error);
  }

  const stats = await getAdminStats();
  return Response.json(stats, { status: 200 });
}
