/**
 * Kept in their own dependency-free module (no Prisma, no next/headers) so
 * that anything needing just "is this an auth error" — tests, error
 * boundaries, future MCP tool wrappers — can import these without dragging
 * in the rest of the auth stack (jose, next/server).
 * authorization.ts re-exports both for backwards-compatible imports.
 */

export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}
