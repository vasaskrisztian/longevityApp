import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { TrendRangeQuerySchema } from '@/lib/validation/dashboard.schemas';
import { getTrend, toTrendPointDTO } from '@/modules/dashboard/dashboard.service';

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
  // See toTrendPointDTO's comment: date must go over the wire as a plain
  // yyyy-mm-dd string, matching what the server-rendered page sends, or the
  // charts' x-axis renders "Invalid Date" after a 7/30-day range switch.
  return Response.json(points.map(toTrendPointDTO), { status: 200 });
}
