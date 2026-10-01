import { z } from 'zod';

/**
 * Shared by Protocol and Challenge create/update schemas (Phase 13).
 * Accepting this on the wire does NOT mean the write is honored as-is —
 * the owning Route Handler rejects `PUBLIC` unless the caller is a
 * consenting CREATOR (see creators.service.ts's canPublishPublicly), the
 * same way `isActive`/`activatedAt` business rules live in the route, not
 * the schema.
 */
export const VisibilityEnum = z.enum(['PRIVATE', 'PUBLIC']);

export type VisibilityInput = z.infer<typeof VisibilityEnum>;
