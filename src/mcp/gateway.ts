import { getTodaySnapshot, getTrend } from '@/modules/dashboard/dashboard.service';
import type { DailyMetricFields, TrendPoint, TrendRangeDays } from '@/modules/dashboard/dashboard.service';

/**
 * ARCHITECTURE.md §9 "MCP future architecture" — this file is the interface
 * given there VERBATIM, plus one concrete implementation. Per §9's rules,
 * enforced by both this file's own imports and the src/mcp/** ESLint
 * override (see .eslintrc.json):
 *
 *   - src/mcp/** may import from modules/**\/services (and, transitively,
 *     modules/dashboard's read-only domain types) ONLY.
 *   - src/mcp/** must never import modules/wearable/providers/** or
 *     lib/encryption/** — this gateway never sees an OAuth token, encrypted
 *     or not, and never calls OuraProviderAdapter directly. It only ever
 *     calls the same dashboard.service functions the authenticated
 *     dashboard route already calls.
 *   - McpAuthContext carries a resolved, already-authorized userId — it is
 *     derived the same way a Route Handler resolves session.user.id (see
 *     auth-context.ts), never accepted as a bare, caller-supplied
 *     parameter. No function below takes a userId argument from outside
 *     this file.
 */

/** Resolved once per MCP server process (see auth-context.ts) — never constructed from a tool-call argument. */
export interface McpAuthContext {
  readonly userId: string;
}

/**
 * ARCHITECTURE.md §13's trend windows are 7 or 30 days — MCP reuses that
 * exact capability (dashboard.service.ts's own TrendRangeDays) rather than
 * inventing an open-ended {start, end} range nothing else in the app
 * supports.
 */
export type McpDateRange = { rangeDays: TrendRangeDays };

/** The MVP ships no derived/computed health summary beyond the day's raw metric fields — see InsightEngine in insight-engine.ts for the (unimplemented) place that would eventually add one. */
export interface HealthSummary extends DailyMetricFields {
  date: string; // ISO date (YYYY-MM-DD)
  isToday: boolean;
  sourceProviders: string[];
}

export interface TrendContextPoint extends DailyMetricFields {
  date: string; // ISO date (YYYY-MM-DD)
}

export interface SleepContext {
  rangeDays: TrendRangeDays;
  points: TrendContextPoint[];
}

export interface RecoveryContext {
  rangeDays: TrendRangeDays;
  points: TrendContextPoint[];
}

export interface ActivityContext {
  rangeDays: TrendRangeDays;
  points: TrendContextPoint[];
}

/**
 * Copied verbatim from ARCHITECTURE.md §9 — exactly four methods. Do not add
 * a fifth here: the fifth MCP tool (get_user_health_summary) is a composite
 * built in src/mcp/tools/register-health-tools.ts out of these four calls,
 * not a new gateway method, so this interface stays a literal match to the
 * spec.
 */
export interface HealthMcpGateway {
  getHealthSummary(ctx: McpAuthContext): Promise<HealthSummary | null>;
  getSleepContext(ctx: McpAuthContext, range: McpDateRange): Promise<SleepContext>;
  getRecoveryContext(ctx: McpAuthContext, range: McpDateRange): Promise<RecoveryContext>;
  getActivityContext(ctx: McpAuthContext, range: McpDateRange): Promise<ActivityContext>;
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toTrendContextPoint(point: TrendPoint): TrendContextPoint {
  return {
    date: toDateOnlyString(point.date),
    sleepScore: point.sleepScore,
    readinessScore: point.readinessScore,
    activityScore: point.activityScore,
    totalSleepMinutes: point.totalSleepMinutes,
    restingHeartRate: point.restingHeartRate,
    averageHrv: point.averageHrv,
    steps: point.steps,
  };
}

/**
 * The MVP's in-process implementation §9 calls for: "a minimal in-process
 * implementation for local testing" — this is also exactly what
 * src/mcp/server.ts wires up for the real stdio server, since there is no
 * separate "production" implementation planned for this phase.
 */
export function createHealthMcpGateway(): HealthMcpGateway {
  return {
    async getHealthSummary(ctx) {
      const snapshot = await getTodaySnapshot(ctx.userId);
      if (!snapshot) {
        return null;
      }
      return {
        date: toDateOnlyString(snapshot.date),
        isToday: snapshot.isToday,
        sourceProviders: snapshot.sourceProviders,
        sleepScore: snapshot.sleepScore,
        readinessScore: snapshot.readinessScore,
        activityScore: snapshot.activityScore,
        totalSleepMinutes: snapshot.totalSleepMinutes,
        restingHeartRate: snapshot.restingHeartRate,
        averageHrv: snapshot.averageHrv,
        steps: snapshot.steps,
      };
    },

    // getSleepContext/getRecoveryContext/getActivityContext all call the
    // same dashboard.service.getTrend() and return the same field set —
    // that function (and the dashboard UI built on it in Phase 6) has never
    // split "sleep" vs "readiness" vs "activity" into separate queries, so
    // MCP does not invent a split the rest of the app doesn't have. Each
    // method is still a separate named tool because a model asking "how's
    // my sleep been" and one asking "how's my activity been" are different
    // requests, even though today's data returns the same rows for both.
    // See docs/phase-10-summary.md's Known limitations for the reasoning.
    async getSleepContext(ctx, range) {
      const points = await getTrend(ctx.userId, range.rangeDays);
      return { rangeDays: range.rangeDays, points: points.map(toTrendContextPoint) };
    },

    async getRecoveryContext(ctx, range) {
      const points = await getTrend(ctx.userId, range.rangeDays);
      return { rangeDays: range.rangeDays, points: points.map(toTrendContextPoint) };
    },

    async getActivityContext(ctx, range) {
      const points = await getTrend(ctx.userId, range.rangeDays);
      return { rangeDays: range.rangeDays, points: points.map(toTrendContextPoint) };
    },
  };
}
