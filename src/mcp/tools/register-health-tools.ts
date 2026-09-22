import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { HealthMcpGateway, McpAuthContext, McpDateRange } from '../gateway';

/**
 * ARCHITECTURE.md §9 names exactly five MCP tools. HealthMcpGateway (see
 * ../gateway.ts) has exactly four methods, copied verbatim from the spec —
 * so get_user_health_summary below is a NEW composite built here, in the
 * tools layer, out of multiple gateway calls, rather than a fifth gateway
 * method. This reconciles the two without editing the gateway's
 * near-literal contract.
 *
 * The single most important property of every schema below: none of them
 * has a `userId` field. That is not an oversight to catch in review — it is
 * the whole point. `ctx` is captured once, outside all five `registerTool`
 * calls (see server.ts), from resolveMcpAuthContextFromEnv(), and every
 * handler below closes over that same `ctx` object. There is no code path
 * through which a model-supplied argument could ever reach `ctx.userId`,
 * because no schema below declares a field that could carry one — see
 * tests/unit/mcp-register-health-tools.test.ts for the assertion that
 * proves this for all five tools at once.
 */

const RANGE_DAYS_DEFAULT = 7 as const;

const rangeDaysShape = {
  rangeDays: z
    .union([z.literal(7), z.literal(30)])
    .default(RANGE_DAYS_DEFAULT)
    .describe('Trend window in days: 7 or 30. Defaults to 7.'),
};

function toMcpDateRange(args: { rangeDays: 7 | 30 }): McpDateRange {
  return { rangeDays: args.rangeDays };
}

function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/**
 * Registers all five tools on `server`, each bound to the single `ctx`
 * resolved for this process (see auth-context.ts) and the given
 * `gateway` (see gateway.ts's createHealthMcpGateway()). Exported as a
 * function of (server, gateway, ctx) — rather than each tool resolving its
 * own context or gateway independently — specifically so tests can inject a
 * fake gateway/ctx without touching real Prisma or environment variables.
 */
export function registerHealthTools(server: McpServer, gateway: HealthMcpGateway, ctx: McpAuthContext): void {
  server.registerTool(
    'get_user_daily_health',
    {
      title: 'Get today\'s health snapshot',
      description:
        "Returns the caller's most recent daily health snapshot (sleep score, readiness score, " +
        'activity score, HRV, resting heart rate, sleep duration, steps). Falls back to the most ' +
        "recent day with data if today's sync hasn't landed yet.",
    },
    async (): Promise<CallToolResult> => {
      const summary = await gateway.getHealthSummary(ctx);
      if (!summary) {
        return jsonResult({ available: false, message: 'No health data is available for this user yet.' });
      }
      return jsonResult({ available: true, summary });
    },
  );

  server.registerTool(
    'get_user_sleep_trend',
    {
      title: 'Get sleep trend',
      description: "Returns the caller's sleep-related metrics (sleep score, total sleep minutes) over a 7 or 30 day window, one point per calendar day.",
      inputSchema: rangeDaysShape,
    },
    async (args): Promise<CallToolResult> => {
      const context = await gateway.getSleepContext(ctx, toMcpDateRange(args));
      return jsonResult(context);
    },
  );

  server.registerTool(
    'get_user_readiness_trend',
    {
      title: 'Get readiness/recovery trend',
      description: "Returns the caller's recovery-related metrics (readiness score, HRV, resting heart rate) over a 7 or 30 day window, one point per calendar day.",
      inputSchema: rangeDaysShape,
    },
    async (args): Promise<CallToolResult> => {
      const context = await gateway.getRecoveryContext(ctx, toMcpDateRange(args));
      return jsonResult(context);
    },
  );

  server.registerTool(
    'get_user_activity_trend',
    {
      title: 'Get activity trend',
      description: "Returns the caller's activity-related metrics (activity score, steps) over a 7 or 30 day window, one point per calendar day.",
      inputSchema: rangeDaysShape,
    },
    async (args): Promise<CallToolResult> => {
      const context = await gateway.getActivityContext(ctx, toMcpDateRange(args));
      return jsonResult(context);
    },
  );

  server.registerTool(
    'get_user_health_summary',
    {
      title: 'Get a combined health summary',
      description:
        "Returns the caller's latest daily snapshot together with sleep, readiness, and activity " +
        'trends over the same window — a single combined call for "how am I doing overall". This is ' +
        'a composite convenience tool: it does not add any data the other four tools do not already ' +
        'expose individually.',
      inputSchema: rangeDaysShape,
    },
    async (args): Promise<CallToolResult> => {
      const range = toMcpDateRange(args);
      const [summary, sleep, recovery, activity] = await Promise.all([
        gateway.getHealthSummary(ctx),
        gateway.getSleepContext(ctx, range),
        gateway.getRecoveryContext(ctx, range),
        gateway.getActivityContext(ctx, range),
      ]);
      return jsonResult({
        latest: summary,
        sleep,
        recovery,
        activity,
      });
    },
  );
}
