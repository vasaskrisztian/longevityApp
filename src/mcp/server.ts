import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createHealthMcpGateway } from './gateway';
import { resolveMcpAuthContextFromEnv } from './auth-context';
import { registerHealthTools } from './tools/register-health-tools';
import { logger } from '@/lib/logging/logger';

/**
 * ARCHITECTURE.md §9's local MCP server entry point — Phase 10, deliberately
 * last per §12 ("only after Phase 1–9 work with MCP absent"). Run with
 * `npm run mcp:server` (requires MCP_USER_ID; see docs/phase-10-summary.md).
 *
 * Follows the same isMainModule / pathToFileURL guard as
 * src/jobs/worker-process.ts, for the same reason: this file must be
 * importable (by tests, and in principle by another process embedding the
 * gateway) without its side effect of opening a stdio transport and
 * blocking on stdin firing just because the module was loaded.
 *
 * Nothing here can be exercised end-to-end in this sandbox — no live
 * Postgres to back gateway.ts's Prisma-backed dashboard.service calls, and
 * no MCP client available to speak the stdio protocol against — the same
 * documented category of limitation as the worker process (see
 * docs/phase-7-summary.md and docs/ci-cd-setup.md). start() itself is
 * covered by tests/unit/mcp-server.test.ts against a mocked SDK; the wiring
 * has otherwise been verified by direct inspection of the installed SDK's
 * type declarations (see docs/phase-10-summary.md).
 */
export async function startMcpServer(): Promise<void> {
  const ctx = resolveMcpAuthContextFromEnv();
  const gateway = createHealthMcpGateway();

  const server = new McpServer({
    name: 'longevity-health-mcp',
    version: '1.0.0',
  });

  registerHealthTools(server, gateway, ctx);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('mcp_server_started', {
    tools: [
      'get_user_daily_health',
      'get_user_sleep_trend',
      'get_user_readiness_trend',
      'get_user_activity_trend',
      'get_user_health_summary',
    ].join(', '),
  });
}

const isMainModule =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  startMcpServer().catch((error) => {
    logger.error('mcp_server_failed_to_start', { message: (error as Error).message });
    process.exitCode = 1;
  });
}
