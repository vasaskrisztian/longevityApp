import type { HealthSummary, McpDateRange, RecoveryContext, SleepContext, ActivityContext } from './gateway';

/**
 * ARCHITECTURE.md §9: "The MVP ships HealthMcpGateway as an interface plus a
 * minimal in-process implementation for local testing; wiring an actual MCP
 * server process is Phase 10, deliberately last" — and separately, the
 * InsightEngine placeholder is scaffolded as an INTERFACE ONLY in the MVP:
 * no diagnostic AI output ships until a dedicated design pass, and even then
 * it stays comparative/observational, never diagnostic (this app is not a
 * medical device and must never produce anything read as a diagnosis or
 * clinical recommendation).
 *
 * This file intentionally contains no implementation, no default export,
 * and is not wired into gateway.ts, register-health-tools.ts, or server.ts.
 * It exists only so the shape §9 describes is captured in code ahead of the
 * design pass that would eventually implement it, and so a future phase has
 * a named contract to implement against rather than inventing one from
 * scratch. Nothing calls this interface yet.
 */
export interface InsightEngine {
  /**
   * A short, comparative/observational note about a single day's snapshot
   * (e.g. "sleep score is below your recent average") — never a diagnosis,
   * never a clinical recommendation, never phrased as medical advice.
   */
  generateDailyInsights(summary: HealthSummary): Promise<string[]>;

  /** The same comparative framing, applied across a trend window instead of a single day. */
  generateTrendInsights(
    context: SleepContext | RecoveryContext | ActivityContext,
    range: McpDateRange,
  ): Promise<string[]>;
}
