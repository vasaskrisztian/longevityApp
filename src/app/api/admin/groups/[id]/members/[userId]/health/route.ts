import { requireAdmin, toErrorResponse } from '@/lib/auth/authorization';
import { getMemberHealthForAdmin } from '@/modules/groups/member-health.service';

/**
 * One member's health data (today's snapshot, 30-day trend, workouts,
 * device status). Only for people who joined THIS group — anyone else is a
 * 404 — and every read is audited (`ADMIN_VIEW_USER`).
 */
export async function GET(_request: Request, { params }: { params: { id: string; userId: string } }) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).id;
  } catch (error) {
    return toErrorResponse(error);
  }
  const health = await getMemberHealthForAdmin(adminId, params.id, params.userId);
  if (!health) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(health, { status: 200 });
}
