/**
 * Kept in their own dependency-free module (no Prisma, no Auth.js) so that
 * anything needing just "is this an auth error" — tests, error boundaries,
 * future MCP tool wrappers — can import these without dragging in the
 * entire Auth.js config (and, transitively, argon2/Prisma/next/server).
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
