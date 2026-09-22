import { UserRole } from '@prisma/client';
import { auth } from '@/lib/auth/auth';
import { UnauthenticatedError, ForbiddenError } from '@/lib/auth/errors';

export { UnauthenticatedError, ForbiddenError };

export interface SessionUser {
  id: string;
  role: UserRole;
  email?: string | null;
}

/**
 * The three helpers below are the ONLY sanctioned way to gate access to
 * user-scoped or admin-scoped data anywhere in the codebase — in Route
 * Handlers, Server Actions, and (later) MCP tools alike. Hiding a link in
 * the UI is never a substitute; see ARCHITECTURE.md §4.2 and the IDOR/BOLA
 * test requirements in §10.6.
 *
 * Call one of these BEFORE touching Prisma, not after.
 */

export async function requireAuthenticatedUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthenticatedError();
  }
  return session.user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuthenticatedUser();
  if (user.role !== UserRole.ADMIN) {
    throw new ForbiddenError('Admin role required');
  }
  return user;
}

/**
 * Allows the request through when the authenticated caller owns the
 * resource (resourceOwnerId === caller.id), OR when the caller is an ADMIN.
 * Every endpoint reading or mutating another user's data must go through
 * this — it is the single choke point the IDOR test suite exercises.
 */
export async function requireOwnResourceOrAdmin(
  resourceOwnerId: string,
): Promise<SessionUser> {
  const user = await requireAuthenticatedUser();
  if (user.id !== resourceOwnerId && user.role !== UserRole.ADMIN) {
    throw new ForbiddenError('You do not have access to this resource');
  }
  return user;
}

/** Maps the auth errors above to a JSON Response — for use in Route Handlers. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthenticatedError || error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
