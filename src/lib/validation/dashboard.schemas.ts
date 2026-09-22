import { z } from 'zod';

/**
 * GET /api/dashboard/trends?range=7|30 — the only two windows ARCHITECTURE.md
 * §13's MVP acceptance criteria calls for ("7-day and 30-day charts").
 * `range` arrives as a query-string value (always a string, or absent), so
 * this validates the raw string form; the route converts the validated
 * `'7' | '30'` string to the `7 | 30` number the service actually wants.
 */
export const TrendRangeQuerySchema = z.object({
  range: z.enum(['7', '30']).default('7'),
});

export type TrendRangeQuery = z.infer<typeof TrendRangeQuerySchema>;
