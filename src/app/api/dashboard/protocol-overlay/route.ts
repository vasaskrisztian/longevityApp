import { requireAuthenticatedUser, toErrorResponse } from '@/lib/auth/authorization';
import { getWeeklyWorkoutCount } from '@/modules/dashboard/dashboard.service';
import { getActiveProtocol } from '@/modules/protocols/protocols.service';

/**
 * Backs the Dashboard's "protocol overlay" — the web dashboard page
 * (src/app/dashboard/page.tsx) composes `getActiveProtocol` and
 * `getWeeklyWorkoutCount` directly in its server component, alongside
 * `getTodaySnapshot`; mobile has no server components, so this is a new,
 * additive route bundling just those other two in one round trip (mobile
 * phase 22's follow-up — flagged as a gap since phase 17). Deliberately a
 * new route rather than reshaping the existing `GET /api/dashboard`'s
 * response from `DashboardSnapshot | null` to a wrapper object: that route
 * has one consumer today (mobile/src/api/dashboard.ts), but changing an
 * existing contract's top-level shape isn't worth it when an additive
 * sibling route does the same job with zero risk to anything already
 * calling it.
 *
 * Always scoped to the caller's own id — never a client-supplied userId —
 * same IDOR choke-point convention as every other user-scoped route.
 */
export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuthenticatedUser()).id;
  } catch (error) {
    return toErrorResponse(error);
  }

  const [activeProtocol, weeklyWorkoutCount] = await Promise.all([
    getActiveProtocol(userId),
    getWeeklyWorkoutCount(userId),
  ]);

  return Response.json({ activeProtocol, weeklyWorkoutCount }, { status: 200 });
}
