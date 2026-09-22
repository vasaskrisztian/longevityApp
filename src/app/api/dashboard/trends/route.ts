import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { TrendRangeQuerySchema } from '@/lib/validation/dashboard.schemas';
import { getTrend } from '@/modules/dashboard/dashboard.service';

/** GET /api/dashboard/trends?range=7|30 — see dashboard.schemas.ts for why range is validated as a string. */
export async function GET(request: Request) {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const url = new URL(request.url);
  const parsed = TrendRangeQuerySchema.safeParse({
    range: url.searchParams.get('range') ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rangeDays = Number(parsed.data.range) as 7 | 30;
  const points = await getTrend(userId, rangeDays);
  return Response.json(points, { status: 200 });
}
