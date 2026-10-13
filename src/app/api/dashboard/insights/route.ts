import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { getInsights } from '@/modules/dashboard/insights.service';

/**
 * GET /api/dashboard/insights — the Today screen's personal-baseline summary
 * (see modules/dashboard/insights.ts). Rules-based, read-only, and always
 * scoped to the caller's own id, never a client-supplied one.
 */
export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  return Response.json(await getInsights(userId), { status: 200 });
}
