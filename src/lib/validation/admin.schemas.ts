import { z } from 'zod';

/**
 * GET /api/admin/users — ARCHITECTURE.md §8.2: "List all users, search,
 * filter by Oura status." `q` is a free-text search over email/full name;
 * `ouraStatus` mirrors `WearableConnectionStatus` plus `ALL` (no filter).
 * `page`/`pageSize` arrive as query-string values (always strings, or
 * absent), hence `z.coerce.number()`.
 */
export const AdminUserListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  ouraStatus: z.enum(['ALL', 'CONNECTED', 'AUTH_REQUIRED', 'ERROR', 'DISCONNECTED']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;
